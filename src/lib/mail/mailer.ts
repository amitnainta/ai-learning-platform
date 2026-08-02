import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { Resend } from "resend";
import { getEnv } from "../env";

/**
 * Transactional email (decision #7 in
 * factory/work/user-accounts-auth/PLAN.md). Three transports behind one
 * `sendMail` call so the absence of a Resend API key degrades gracefully
 * (console transport) instead of breaking `next build`/local dev, and so
 * Playwright e2e can read a real action link without a mail provider (file
 * transport writes to a gitignored `.mail-outbox/`).
 *
 * Never log `RESEND_API_KEY` or any other secret from this module.
 */

export interface MailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export type MailTransport = "resend" | "console" | "file";

const OUTBOX_DIR = path.join(process.cwd(), ".mail-outbox");

/**
 * Resolve which transport to use: an explicit `MAIL_TRANSPORT` override
 * wins; otherwise `resend` when a key is configured, else `console`.
 */
export function resolveMailTransport(): MailTransport {
  const env = getEnv();
  if (env.MAIL_TRANSPORT) {
    return env.MAIL_TRANSPORT;
  }
  return env.RESEND_API_KEY ? "resend" : "console";
}

async function sendViaResend(message: MailMessage): Promise<void> {
  const env = getEnv();
  if (!env.RESEND_API_KEY) {
    throw new Error(
      "MAIL_TRANSPORT=resend but RESEND_API_KEY is not set. " +
        "See docs/runbooks/provisioning-checklist.md.",
    );
  }
  const resend = new Resend(env.RESEND_API_KEY);
  const { error } = await resend.emails.send({
    from: env.EMAIL_FROM,
    to: message.to,
    subject: message.subject,
    html: message.html,
    text: message.text,
  });
  if (error) {
    // Never include the API key; `error` from the Resend SDK does not
    // carry it, only request-shape details.
    throw new Error(`Resend send failed: ${error.message}`);
  }
}

function sendViaConsole(message: MailMessage): void {
  // Dev default: make the action link (reset/verify/etc.) visible in the
  // terminal without requiring any mail provider setup.
  console.log(`[mail:console] to=${message.to} subject="${message.subject}"\n${message.text}`);
}

async function sendViaFile(message: MailMessage): Promise<void> {
  await mkdir(OUTBOX_DIR, { recursive: true });
  const fileName = `${Date.now()}-${message.to.replace(/[^a-z0-9@.-]/gi, "_")}.json`;
  await writeFile(
    path.join(OUTBOX_DIR, fileName),
    JSON.stringify({ ...message, sentAt: new Date().toISOString() }, null, 2),
    "utf-8",
  );
}

export async function sendMail(message: MailMessage): Promise<void> {
  const transport = resolveMailTransport();
  switch (transport) {
    case "resend":
      return sendViaResend(message);
    case "file":
      return sendViaFile(message);
    case "console":
    default:
      return sendViaConsole(message);
  }
}
