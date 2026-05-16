import NextAuth, { type DefaultSession } from "next-auth";
import Google from "next-auth/providers/google";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { db } from "@/db";
import { users, accounts, verificationTokens } from "@/db/schema";
import { eq } from "drizzle-orm";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: "member" | "leader" | "organiser" | "admin";
      onboarded: boolean;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    role?: "member" | "leader" | "organiser" | "admin";
    onboarded?: boolean;
  }
}

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
      // On sign-in, copy id from the adapter's user. On every request, refresh
      // role + onboarded flag from the DB so promotions / onboarding completion
      // propagate without re-login.
      if (user) {
        token.id = user.id;
      }
      if (token.id && (trigger === "signIn" || trigger === "update" || !token.role)) {
        const [row] = await db
          .select({ role: users.role, onboardedAt: users.onboardedAt })
          .from(users)
          .where(eq(users.id, token.id))
          .limit(1);
        if (row) {
          token.role = row.role;
          token.onboarded = row.onboardedAt !== null;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (token.id) session.user.id = token.id;
      if (token.role) session.user.role = token.role;
      session.user.onboarded = token.onboarded ?? false;
      return session;
    },
  },
  trustHost: true,
});
