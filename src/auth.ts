import NextAuth, { type DefaultSession } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { db } from "@/db";
import { users } from "@/db/schema";
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

// Email-only credentials. We do NOT verify the email (no OTP, no link) —
// admin approval is the entire gatekeeper. Trust model: a small club where
// admin recognises members out-of-band; anyone claiming an email they don't
// own gets rejected at admin review.
//
// Behaviour:
//  - Unknown email → create user (status=pending)
//  - Known pending/approved → sign in as that user
//  - Known rejected → AUTO-FLIP to pending (user "re-sign-up" =
//    re-application per user spec) and sign in
export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
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
          if (existing.status === "rejected") {
            // Re-application: clear rejection, back to pending
            await db
              .update(users)
              .set({
                status: "pending",
                rejectedReason: null,
                approvedAt: null,
                approvedBy: null,
                updatedAt: new Date(),
              })
              .where(eq(users.id, existing.id));
          }
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
  ],
  session: { strategy: "jwt" },
  callbacks: {
    ...authConfig.callbacks,
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
