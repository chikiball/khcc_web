import NextAuth, { type DefaultSession } from "next-auth";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { db } from "@/db";
import { users, accounts, verificationTokens } from "@/db/schema";
import { eq } from "drizzle-orm";
import authConfig from "@/auth.config";

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

// Local JWT shape — augmenting "next-auth/jwt" is brittle across v5 betas.
type AppToken = {
  id?: string;
  role?: Role;
  onboarded?: boolean;
};

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    verificationTokensTable: verificationTokens,
  }),
  session: { strategy: "jwt" },
  callbacks: {
    ...authConfig.callbacks,
    async jwt({ token, user, trigger }) {
      const t = token as typeof token & AppToken;
      if (user?.id) t.id = user.id;
      // Also refresh while !t.onboarded — otherwise the JWT stays stale
      // after the onboarding action writes to DB and we get a /rides ↔
      // /onboarding redirect loop. Once onboarded is true the token
      // caches it and this branch is skipped.
      if (
        t.id &&
        (trigger === "signIn" || trigger === "update" || !t.role || !t.onboarded)
      ) {
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
