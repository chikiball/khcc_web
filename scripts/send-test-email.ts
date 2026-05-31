/**
 * Send a test email to verify SMTP credentials.
 *
 * Usage (from inside burkam-web container):
 *   docker exec burkam-web node node_modules/tsx/dist/cli.mjs scripts/send-test-email.ts you@example.com
 */

import { sendEmail, emailTemplate } from "../src/lib/email";

const to = process.argv[2];
if (!to) {
  console.error("Usage: tsx scripts/send-test-email.ts <recipient>");
  process.exit(1);
}

const html = emailTemplate({
  title: "SMTP test",
  body: "<p>If you can read this, the relay works.</p><p>You can throw away this email.</p>",
  ctaText: "Open Burkam",
  ctaUrl: process.env.NEXT_PUBLIC_SITE_URL ?? "https://burkam.nandharu.uk",
});

sendEmail({ to, subject: "Burkam SMTP test", html })
  .then((info) => {
    console.log("✓ sent — messageId:", info.messageId);
    process.exit(0);
  })
  .catch((err) => {
    console.error("✗ failed:", err.message);
    process.exit(1);
  });
