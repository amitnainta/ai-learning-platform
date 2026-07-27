/**
 * Plain HTML + text templates for transactional email. Every dynamic value
 * is escaped (`escapeHtml`) before interpolation — none of these ever embed
 * raw user-controlled HTML (NFR-SEC-007).
 */

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function layout(title: string, bodyHtml: string): string {
  return `<!doctype html>
<html>
  <body style="font-family: sans-serif; background: #0b0f14; color: #e6ebf1; padding: 24px;">
    <h1 style="font-size: 20px;">${escapeHtml(title)}</h1>
    ${bodyHtml}
    <p style="color: #9aa7b6; font-size: 12px; margin-top: 32px;">AI Learning Platform</p>
  </body>
</html>`;
}

export interface MailTemplate {
  subject: string;
  html: string;
  text: string;
}

export function verifyEmailTemplate(params: { name: string; url: string }): MailTemplate {
  const { name, url } = params;
  const subject = "Verify your email address";
  return {
    subject,
    html: layout(
      subject,
      `<p>Hi ${escapeHtml(name)},</p>
      <p>Confirm this is your email address by clicking the link below.</p>
      <p><a href="${escapeHtml(url)}">Verify my email</a></p>
      <p>If you didn't create an account, you can ignore this email.</p>`,
    ),
    text: `Hi ${name},\n\nConfirm this is your email address: ${url}\n\nIf you didn't create an account, you can ignore this email.`,
  };
}

export function resetPasswordTemplate(params: {
  name: string;
  url: string;
  expiresInMinutes: number;
}): MailTemplate {
  const { name, url, expiresInMinutes } = params;
  const subject = "Reset your password";
  return {
    subject,
    html: layout(
      subject,
      `<p>Hi ${escapeHtml(name)},</p>
      <p>Someone requested a password reset for this account. Click the link below to choose a new password.</p>
      <p><a href="${escapeHtml(url)}">Reset my password</a></p>
      <p>This link expires in ${expiresInMinutes} minutes and can only be used once. If you didn't request this, you can safely ignore this email — your password will not change.</p>`,
    ),
    text: `Hi ${name},\n\nReset your password: ${url}\n\nThis link expires in ${expiresInMinutes} minutes and can only be used once. If you didn't request this, ignore this email.`,
  };
}

export function accountDeletedTemplate(params: { name: string }): MailTemplate {
  const { name } = params;
  const subject = "Your account has been deleted";
  return {
    subject,
    html: layout(
      subject,
      `<p>Hi ${escapeHtml(name)},</p>
      <p>This confirms your AI Learning Platform account and all associated data have been permanently deleted, as requested.</p>
      <p>If you didn't request this, please contact support immediately.</p>`,
    ),
    text: `Hi ${name},\n\nThis confirms your AI Learning Platform account and all associated data have been permanently deleted, as requested.\n\nIf you didn't request this, please contact support immediately.`,
  };
}
