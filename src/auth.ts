import NextAuth, { type DefaultSession } from "next-auth";
import Google from "next-auth/providers/google";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { db } from "@/db";
import { users, accounts, verificationTokens } from "@/db/schema";
import { eq } from "drizzle-orm";

type Role = "member" | "leader" | "organiser" | "admin";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: Role;
      onboarded: boolean;
    } & DefaultSession["user"];
  }
}

// JWT shape we attach to the token. We don't `declare module "next-auth/jwt"`
// because that augmentation is brittle across Auth.js v5 beta versions
// (TS2664 in some setups). Casting inside the callbacks is portable.
type AppToken = {
  id?: string;
  role?: Role;
  onboarded?: boolean;
};

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    verificationTokensTable: verificationTokens,
    // No sessions table — JWT strategy doesn't need one.
  }),
  session: { strategy: "jwt" },
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
    }),
  ],
  pages: {
    signIn: "/login",
  },
  callbacks: {
    async jwt({ token, user, trigger }) {
      const t = token as typeof token & AppToken;

      // On sign-in, the adapter passes the freshly-created/loaded user.
      if (user?.id) {
        t.id = user.id;
      }

      // Refresh role + onboarded from the DB on signIn, on explicit `update`,
      // or whenever the token doesn't yet have a role (first request after
      // sign-in). This ensures admin promotions and onboarding completion
      // propagate without forcing re-login.
      if (t.id && (trigger === "signIn" || trigger === "update" || !t.role)) {
        const [row] = await db
          .select({ role: users.role, onboardedAt: users.onboardedAt })
          .from(users)
          .where(eq(users.id, t.id))
          .limit(1);
        if (row) {
          t.role = row.role;
          t.onboarded = row.onboardedAt !== null;
        }
      }

      return t;
    },
    async session({ session, token }) {
      const t = token as typeof token & AppToken;
      if (t.id) session.user.id = t.id;
      if (t.role) session.user.role = t.role;
      session.user.onboarded = t.onboarded ?? false;
      return session;
    },
  },
  trustHost: true,
});
