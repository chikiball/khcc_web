import NextAuth, { type DefaultSession } from "next-auth";
import Nodemailer from "next-auth/providers/nodemailer";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { db } from "@/db";
import { users, accounts, verificationTokens } from "@/db/schema";
import { eq } from "drizzle-orm";
import authConfig from "@/auth.config";
import { sendEmail, emailTemplate } from "@/lib/email";

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

// Auth.js Nodemailer provider needs a Node-only transport, so it lives only
// in this file (auth.ts), not in auth.config.ts which has to stay edge-safe.
// We re-list Google here too because spreading authConfig.providers and then
// appending email-magic would be cleaner — but our authConfig only has Google
// for the edge `authorized` callback's typing, and rebuilding it here keeps
// provider config in one place.
const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://khcc.nandharu.uk";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    verificationTokensTable: verificationTokens,
  }),
  providers: [
    ...authConfig.providers.map((p) =>
      // Allow account linking by verified email so a magic-link signup
      // and a later Google sign-in for the same email map to ONE user row.
      // Safe here because both Google email and our magic-link email are
      // verified by their respective providers before account creation.
      typeof p === "function"
        ? p
        : { ...p, allowDangerousEmailAccountLinking: true },
    ),
    Nodemailer({
      server: {
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT) || 587,
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASSWORD,
        },
      },
      from: process.env.SMTP_FROM,
      // Brand the verification email with our existing template instead of
      // Auth.js's default. We re-use sendEmail() so deliverability behaviour
      // matches every other transactional email we send.
      async sendVerificationRequest({ identifier, url }) {
        const html = emailTemplate({
          title: "Sign in to KHCC",
          body: `<p>Tap the button below to sign in. The link is good for 24 hours.</p>
                 <p style="font-size:12px;color:#7a2c40;margin-top:24px">
                   If you didn&rsquo;t request this, ignore this email — no account is created until you click the link.
                 </p>`,
          ctaText: "Sign in →",
          ctaUrl: url,
        });
        await sendEmail({
          to: identifier,
          subject: "Sign in to KHCC",
          html,
        });
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
  // Suppress the default unused-export warning. Reference SITE_URL so
  // the build doesn't tree-shake it (used by sendVerificationRequest).
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  ...(SITE_URL ? {} : {}),
});
