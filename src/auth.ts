import NextAuth, { type DefaultSession } from "next-auth";
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

// Local JWT shape — augmenting "next-auth/jwt" is brittle across v5 betas.
type AppToken = {
  id?: string;
  role?: Role;
  status?: Status;
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
      // Refresh while !approved or !onboarded — both transient states that
      // change without a re-login. Once approved AND onboarded, the token
      // caches and we skip the DB query on every subsequent request.
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
