"use client";

import { useState } from "react";
import { authClient } from "@/lib/auth/client";

/**
 * Dismissible banner shown to signed-in users whose email isn't verified
 * yet (decision #8: verification doesn't gate sign-in, but stays visible
 * and actionable).
 */
export function VerifyEmailBanner({ email }: { email: string }) {
  const [dismissed, setDismissed] = useState(false);
  const [status, setStatus] = useState<"idle" | "sending" | "sent">("idle");

  if (dismissed) {
    return null;
  }

  async function handleResend() {
    setStatus("sending");
    await authClient.sendVerificationEmail({ email });
    setStatus("sent");
  }

  return (
    <div
      role="status"
      className="mb-6 flex items-center justify-between gap-4 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-sm"
    >
      <span>
        {status === "sent"
          ? "Verification email sent — check your inbox."
          : "Please verify your email address."}
      </span>
      <span className="flex gap-3">
        <button
          type="button"
          onClick={handleResend}
          disabled={status === "sending"}
          className="text-[var(--color-primary)] underline disabled:opacity-50"
        >
          {status === "sending" ? "Sending…" : "Resend email"}
        </button>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="text-[var(--color-text-muted)]"
        >
          Dismiss
        </button>
      </span>
    </div>
  );
}
