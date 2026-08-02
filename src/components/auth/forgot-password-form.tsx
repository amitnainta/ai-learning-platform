"use client";

import { useState, type FormEvent } from "react";
import { authClient } from "@/lib/auth/client";
import { forgotPasswordSchema } from "@/lib/validation/account";
import { FormField } from "@/components/ui/form-field";

// Always shown after a submit attempt, regardless of whether the address
// exists — no account enumeration (AC5 / test plan notes).
const CONFIRMATION_MESSAGE =
  "If an account exists for that email address, check your inbox for a link to reset your password.";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | undefined>(undefined);
  const [isPending, setIsPending] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const result = forgotPasswordSchema.safeParse({ email });
    if (!result.success) {
      setError(result.error.issues[0]?.message);
      return;
    }
    setError(undefined);
    setIsPending(true);

    // Intentionally ignore the result shape here: the confirmation message
    // is identical whether or not the account exists.
    await authClient.requestPasswordReset({
      email: result.data.email,
      redirectTo: "/reset-password",
    });

    setIsPending(false);
    setSubmitted(true);
  }

  if (submitted) {
    return (
      <p role="status" className="max-w-sm text-sm text-[var(--color-text)]">
        {CONFIRMATION_MESSAGE}
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex max-w-sm flex-col gap-4">
      <FormField
        label="Email"
        name="email"
        type="email"
        autoComplete="email"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        error={error}
      />
      <button
        type="submit"
        disabled={isPending}
        className="rounded-md bg-[var(--color-primary)] px-4 py-2 font-medium text-[#0b0f14] hover:bg-[var(--color-primary-hover)] disabled:opacity-50"
      >
        {isPending ? "Sending…" : "Send reset link"}
      </button>
    </form>
  );
}
