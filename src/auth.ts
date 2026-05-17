import NextAuth, { type DefaultSession } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { db } from "@/db";
import { users, accounts, verificationTokens } from "@/db/schema";
import { eq } from "drizzle-orm";
import authConfig from "@/auth.config";

type Role = "member" | "leader" | "organiser" | "admin";
type Status = "pending" | "approved" | "rejected";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: Role;
      status: Status;
      onboarded: boolean;
    } & DefaultSession["user"];
  }
}

type AppToken = {
  id?: string;
  role?: Role;
  status?: Status;
  onboarded?: boolean;
};

// Two providers, identical admin-approval flow:
//   - Credentials: user types email → no verification → admin reviews
//   - Google OAuth: user signs in with Google → email is verified → admin reviews
// In both cases:
//   - Unknown email → user row created (status=pending) → /pending
//   - Known approved → /rides
//   - Known rejected → AUTO-FLIP to pending in signIn callback → /pending
//
// allowDangerousEmailAccountLinking on Google is safe because email is the
// shared identity column and we trust admin to gate; it lets a user who first
// signed up via Credentials later log in with Google for the same email and
// land on the same users row.
export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    verificationTokensTable: verificationTokens,
  }),
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
      },
      async authorize(credentials) {
        const raw = credentials?.email;
        if (typeof raw !== "string") return null;
        const email = raw.trim().toLowerCase();
        if (!email || !email.includes("@") || email.length > 254) return null;

        const [existing] = await db
          .select()
          .from(users)
          .where(eq(users.email, email))
          .limit(1);

        if (existing) {
          return {
            id: existing.id,
            email: existing.email,
            name: existing.name,
            image: existing.image,
          };
        }

        const [created] = await db
          .insert(users)
          .values({ email, status: "pending" })
          .returning();

        return {
          id: created.id,
          email: created.email,
          name: created.name,
          image: created.image,
        };
      },
    }),
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
      allowDangerousEmailAccountLinking: true,
    }),
  ],
  session: { strategy: "jwt" },
  callbacks: {
    ...authConfig.callbacks,
    async signIn({ user }) {
      // Auto-flip rejected → pending on any sign-in. Mirrors the user spec:
      // "user re-sign-up = back to pending". Runs after Credentials
      // authorize() returns a user, and after OAuth adapter creates/links
      // the user row. Never blocks the sign-in — always returns true.
      if (user?.id) {
        const [row] = await db
          .select({ status: users.status })
          .from(users)
          .where(eq(users.id, user.id))
          .limit(1);
        if (row?.status === "rejected") {
          await db
            .update(users)
            .set({
              status: "pending",
              rejectedReason: null,
              approvedAt: null,
              approvedBy: null,
              updatedAt: new Date(),
            })
            .where(eq(users.id, user.id));
        }
      }
      return true;
    },
    async jwt({ token, user, trigger }) {
      const t = token as typeof token & AppToken;
      if (user?.id) t.id = user.id;
      if (
        t.id &&
        (trigger === "signIn" ||
          trigger === "update" ||
          !t.role ||
          !t.onboarded ||
          t.status !== "approved")
      ) {
        const [row] = await db
          .select({
            role: users.role,
            status: users.status,
            onboardedAt: users.onboardedAt,
          })
          .from(users)
          .where(eq(users.id, t.id))
          .limit(1);
        if (row) {
          t.role = row.role;
          t.status = row.status;
          t.onboarded = row.onboardedAt !== null;
        }
      }
      return t;
    },
    async session({ session, token }) {
      const t = token as typeof token & AppToken;
      if (t.id) session.user.id = t.id;
      if (t.role) session.user.role = t.role;
      session.user.status = t.status ?? "pending";
      session.user.onboarded = t.onboarded ?? false;
      return session;
    },
  },
  trustHost: true,
});
