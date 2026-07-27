"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { authClient } from "@/lib/auth/client";
import { signUpSchema } from "@/lib/validation/account";
import { FormField } from "@/components/ui/form-field";

type FieldErrors = Partial<
  Record<"name" | "email" | "password" | "minimumAgeAcknowledged", string>
>;

export function SignUpForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [minimumAgeAcknowledged, setMinimumAgeAcknowledged] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    const result = signUpSchema.safeParse({ name, email, password, minimumAgeAcknowledged });
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

    const { error } = await authClient.signUp.email({
      name: result.data.name,
      email: result.data.email,
      password: result.data.password,
      // Better Auth `user.additionalFields` (src/lib/auth/options.ts):
      // written atomically at account creation via the sign-up call itself
      // (NFR-SEC-011) — the acknowledgment is already gated by
      // `signUpSchema` above, so by the time we get here it's always true.
      minimumAgeAcknowledgedAt: new Date(),
    });

    setIsPending(false);

    if (error) {
      setFormError(error.message ?? "Something went wrong. Please try again.");
      return;
    }

    router.push("/onboarding");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex max-w-sm flex-col gap-4">
      <FormField
        label="Name"
        name="name"
        type="text"
        autoComplete="name"
        value={name}
        onChange={(event) => setName(event.target.value)}
        error={errors.name}
      />
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
        autoComplete="new-password"
        hint="At least 12 characters."
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        error={errors.password}
      />
      <div className="flex flex-col gap-1">
        <label htmlFor="minimumAgeAcknowledged" className="flex items-start gap-2 text-sm">
          <input
            id="minimumAgeAcknowledged"
            name="minimumAgeAcknowledged"
            type="checkbox"
            checked={minimumAgeAcknowledged}
            onChange={(event) => setMinimumAgeAcknowledged(event.target.checked)}
            aria-describedby={
              errors.minimumAgeAcknowledged ? "minimumAgeAcknowledged-error" : undefined
            }
          />
          <span>I confirm I am 16 years of age or older.</span>
        </label>
        <p
          id="minimumAgeAcknowledged-error"
          aria-live="polite"
          className="min-h-[1rem] text-xs text-[var(--color-danger)]"
        >
          {errors.minimumAgeAcknowledged ?? ""}
        </p>
      </div>
      <p aria-live="polite" className="min-h-[1rem] text-sm text-[var(--color-danger)]">
        {formError ?? ""}
      </p>
      <button
        type="submit"
        disabled={isPending}
        className="rounded-md bg-[var(--color-primary)] px-4 py-2 font-medium text-[#0b0f14] hover:bg-[var(--color-primary-hover)] disabled:opacity-50"
      >
        {isPending ? "Creating account…" : "Create account"}
      </button>
    </form>
  );
}
