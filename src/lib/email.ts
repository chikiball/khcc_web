import nodemailer from "nodemailer";

// Single shared transporter — initialised lazily on first send so module
// loads (and middleware) don't fail when SMTP env vars are unset (e.g.
// during build or in tests).
let transporter: nodemailer.Transporter | null = null;

function getTransporter() {
  if (transporter) return transporter;

  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT) || 587;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASSWORD;

  if (!host || !user || !pass) {
    throw new Error(
      "SMTP not configured — set SMTP_HOST / SMTP_USER / SMTP_PASSWORD in env",
    );
  }

  transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465, // true for SMTPS (465), false for STARTTLS (587)
    auth: { user, pass },
  });

  return transporter;
}

export async function sendEmail(opts: {
  to: string;
  subject: string;
  html: string;
  text?: string;
}) {
  const t = getTransporter();
  const from = process.env.SMTP_FROM ?? `"KHCC" <${process.env.SMTP_USER}>`;
  return t.sendMail({ from, ...opts });
}

/**
 * Minimal HTML email template — coral header, cream body, single CTA.
 * Inline CSS only (most clients strip <style>).
 */
export function emailTemplate(opts: {
  title: string;
  body: string;
  ctaText?: string;
  ctaUrl?: string;
}) {
  const { title, body, ctaText, ctaUrl } = opts;
  const cta =
    ctaText && ctaUrl
      ? `<a href="${ctaUrl}" style="display:inline-block;padding:12px 24px;background:#ec6e8a;color:#fdfaf5;border-radius:12px;font-weight:600;text-decoration:none;font-family:system-ui,-apple-system,sans-serif">${ctaText}</a>`
      : "";

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f4ece0;font-family:system-ui,-apple-system,sans-serif;color:#3d1620">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4ece0;padding:32px 16px">
    <tr><td align="center">
      <table width="480" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(61,22,32,0.08)">
        <tr><td style="padding:24px 28px;background:#ec6e8a;color:#fdfaf5">
          <div style="font-size:11px;letter-spacing:2px;font-weight:800">KHCC</div>
          <div style="font-size:22px;font-weight:700;margin-top:4px;line-height:1.2">${title}</div>
        </td></tr>
        <tr><td style="padding:24px 28px;font-size:15px;line-height:1.55">
          ${body}
          ${cta ? `<div style="margin-top:24px">${cta}</div>` : ""}
        </td></tr>
        <tr><td style="padding:16px 28px;font-size:11px;color:#7a2c40;border-top:1px solid #f3dfe2">
          Knock House Chop Chop · ride and go home
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}
