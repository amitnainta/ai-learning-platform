"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { authClient } from "@/lib/auth/client";
import { signInSchema } from "@/lib/validation/account";
import { FormField } from "@/components/ui/form-field";

type FieldErrors = Partial<Record<"email" | "password", string>>;

// Deliberately generic — never reveals whether the email exists (FR-ACC-002).
const GENERIC_SIGN_IN_ERROR = "Incorrect email or password.";

export function SignInForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    const result = signInSchema.safeParse({ email, password });
    if (!result.success) {
      const fieldErrors: FieldErrors = {};
      for (const issue of result.error.issues) {
        const key = issue.path[0] as keyof FieldErrors;
        if (key && !fieldErrors[key]) {
          fieldErrors[key] = issue.message;
        }
      }
      setErrors(fieldErrors);
      return;
    }
    setErrors({});
    setIsPending(true);

    const { error } = await authClient.signIn.email({
      email: result.data.email,
      password: result.data.password,
    });

    setIsPending(false);

    if (error) {
      setFormError(GENERIC_SIGN_IN_ERROR);
      return;
    }

    const next = searchParams.get("next");
    router.push(next && next.startsWith("/") ? next : "/dashboard");
    router.refresh();
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
        error={errors.email}
      />
      <FormField
        label="Password"
        name="password"
        type="password"
        autoComplete="current-password"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        error={errors.password}
      />
      <p aria-live="polite" className="min-h-[1rem] text-sm text-[var(--color-danger)]">
        {formError ?? ""}
      </p>
      <button
        type="submit"
        disabled={isPending}
        className="rounded-md bg-[var(--color-primary)] px-4 py-2 font-medium text-[#0b0f14] hover:bg-[var(--color-primary-hover)] disabled:opacity-50"
      >
        {isPending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
