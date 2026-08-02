"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { authClient } from "@/lib/auth/client";
import { resetPasswordSchema } from "@/lib/validation/account";
import { FormField } from "@/components/ui/form-field";

export function ResetPasswordForm({ token }: { token: string | null }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | undefined>(undefined);
  const [formError, setFormError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  if (!token) {
    return (
      <p role="alert" className="max-w-sm text-sm text-[var(--color-danger)]">
        This password reset link is missing or has expired. Request a new one from the{" "}
        <a href="/forgot-password" className="underline">
          forgot password
        </a>{" "}
        page.
      </p>
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    const result = resetPasswordSchema.safeParse({ token, password });
    if (!result.success) {
      setError(result.error.issues[0]?.message);
      return;
    }
    setError(undefined);
    setIsPending(true);

    const { error: resetError } = await authClient.resetPassword({
      newPassword: result.data.password,
      token: result.data.token,
    });

    setIsPending(false);

    if (resetError) {
      setFormError(
        resetError.message ?? "This reset link is invalid or has expired. Request a new one.",
      );
      return;
    }

    router.push("/sign-in");
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex max-w-sm flex-col gap-4">
      <FormField
        label="New password"
        name="password"
        type="password"
        autoComplete="new-password"
        hint="At least 12 characters."
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        error={error}
      />
      <p aria-live="polite" className="min-h-[1rem] text-sm text-[var(--color-danger)]">
        {formError ?? ""}
      </p>
      <button
        type="submit"
        disabled={isPending}
        className="rounded-md bg-[var(--color-primary)] px-4 py-2 font-medium text-[#0b0f14] hover:bg-[var(--color-primary-hover)] disabled:opacity-50"
      >
        {isPending ? "Resetting…" : "Reset password"}
      </button>
    </form>
  );
}
