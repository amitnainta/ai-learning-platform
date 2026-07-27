import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

/**
 * Reads e2e-captured mail from the `MAIL_TRANSPORT=file` outbox (task 42 in
 * factory/work/user-accounts-auth/PLAN.md) so specs can extract a real
 * password-reset / verification link without a mail provider. Mirrors the
 * shape written by src/lib/mail/mailer.ts's file transport.
 */

const OUTBOX_DIR = path.join(process.cwd(), ".mail-outbox");

export interface OutboxMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
  sentAt: string;
}

/**
 * Waits for and returns the newest outbox message addressed to `email`
 * (case-insensitive). The mailer write can lag slightly behind the UI
 * action that triggers it, so this polls rather than reading once.
 */
export async function readLatestMailFor(
  email: string,
  options: { timeoutMs?: number; pollIntervalMs?: number } = {},
): Promise<OutboxMessage> {
  const { timeoutMs = 15_000, pollIntervalMs = 250 } = options;
  const target = email.toLowerCase();
  const deadline = Date.now() + timeoutMs;

  for (;;) {
    const message = await findLatestMessageFor(target);
    if (message) {
      return message;
    }
    if (Date.now() >= deadline) {
      throw new Error(`No mail-outbox message found for ${email} within ${timeoutMs}ms`);
    }
    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }
}

async function findLatestMessageFor(target: string): Promise<OutboxMessage | null> {
  let fileNames: string[];
  try {
    fileNames = await readdir(OUTBOX_DIR);
  } catch {
    return null;
  }

  const candidates = fileNames.filter((name) => name.endsWith(".json")).sort();
  // File names are `${Date.now()}-...json`, so lexicographic sort is
  // chronological; walk from newest to oldest.
  for (let i = candidates.length - 1; i >= 0; i -= 1) {
    const fileName = candidates[i];
    if (!fileName) {
      continue;
    }
    try {
      const contents = await readFile(path.join(OUTBOX_DIR, fileName), "utf-8");
      const message = JSON.parse(contents) as OutboxMessage;
      if (message.to?.toLowerCase() === target) {
        return message;
      }
    } catch {
      // Ignore a file that's still being written or isn't valid JSON yet.
    }
  }
  return null;
}

/** Extracts the first http(s) action link from a message's plain-text body. */
export function extractActionLink(message: OutboxMessage): string {
  const match = message.text.match(/https?:\/\/\S+/);
  if (!match) {
    throw new Error(`No action link found in message text: ${message.text}`);
  }
  return match[0];
}
