"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import {
  profileSchema,
  proficiencyLevelSchema,
  roleArchetypeSchema,
} from "@/lib/validation/account";

type RoleArchetype = (typeof roleArchetypeSchema)["options"][number];
type ProficiencyLevel = (typeof proficiencyLevelSchema)["options"][number];

const ROLE_OPTIONS: { value: RoleArchetype; label: string; description: string }[] = [
  {
    value: "TECHNICAL_BUILDER",
    label: "Technical builder",
    description: "I write code and want to build with AI/ML directly.",
  },
  {
    value: "ENGINEERING_LEADER",
    label: "Engineering leader",
    description: "I lead technical teams and need to guide AI adoption.",
  },
  {
    value: "EXECUTIVE_NON_TECHNICAL",
    label: "Executive / non-technical",
    description: "I make decisions about AI but don't write code.",
  },
  {
    value: "INVESTOR",
    label: "Investor",
    description: "I evaluate AI companies and technology from the outside.",
  },
  {
    value: "NOT_SURE_YET",
    label: "Not sure yet",
    description: "Skip this for now — you can change it any time.",
  },
];

const LEVEL_OPTIONS: { value: ProficiencyLevel; label: string; description: string }[] = [
  {
    value: "ZERO_KNOWLEDGE",
    label: "Zero knowledge",
    description: "New to AI/ML — start from the fundamentals.",
  },
  {
    value: "INTERMEDIATE",
    label: "Intermediate",
    description: "Comfortable with the basics, ready to go deeper.",
  },
  {
    value: "ADVANCED",
    label: "Advanced",
    description: "Experienced — looking for advanced material.",
  },
];

interface RoleLevelFormProps {
  initialRole?: RoleArchetype | null;
  initialLevel?: ProficiencyLevel | null;
  submitLabel: string;
  redirectTo: string;
}

export function RoleLevelForm({
  initialRole,
  initialLevel,
  submitLabel,
  redirectTo,
}: RoleLevelFormProps) {
  const router = useRouter();
  const [role, setRole] = useState<RoleArchetype | undefined>(initialRole ?? undefined);
  const [level, setLevel] = useState<ProficiencyLevel | undefined>(initialLevel ?? undefined);
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const result = profileSchema.safeParse({ roleArchetype: role, level });
    if (!result.success) {
      setError("Please select a role and a level to continue.");
      return;
    }

    setIsPending(true);
    const response = await fetch("/api/account/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(result.data),
    });
    setIsPending(false);

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      setError(body.error ?? "Something went wrong. Please try again.");
      return;
    }

    router.push(redirectTo);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="flex max-w-2xl flex-col gap-8">
      <fieldset className="flex flex-col gap-3">
        <legend className="mb-1 text-lg font-medium text-[var(--color-text)]">
          Which best describes you?
        </legend>
        {ROLE_OPTIONS.map((option) => (
          <label
            key={option.value}
            className="flex cursor-pointer items-start gap-3 rounded-md border border-[var(--color-border)] p-3 has-checked:border-[var(--color-primary)]"
          >
            <input
              type="radio"
              name="roleArchetype"
              value={option.value}
              checked={role === option.value}
              onChange={() => setRole(option.value)}
            />
            <span>
              <span className="block font-medium text-[var(--color-text)]">{option.label}</span>
              <span className="block text-sm text-[var(--color-text-muted)]">
                {option.description}
              </span>
            </span>
          </label>
        ))}
      </fieldset>

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-1 text-lg font-medium text-[var(--color-text)]">
          What&apos;s your current level?
        </legend>
        {LEVEL_OPTIONS.map((option) => (
          <label
            key={option.value}
            className="flex cursor-pointer items-start gap-3 rounded-md border border-[var(--color-border)] p-3 has-checked:border-[var(--color-primary)]"
          >
            <input
              type="radio"
              name="level"
              value={option.value}
              checked={level === option.value}
              onChange={() => setLevel(option.value)}
            />
            <span>
              <span className="block font-medium text-[var(--color-text)]">{option.label}</span>
              <span className="block text-sm text-[var(--color-text-muted)]">
                {option.description}
              </span>
            </span>
          </label>
        ))}
      </fieldset>

      <p aria-live="polite" className="min-h-[1rem] text-sm text-[var(--color-danger)]">
        {error ?? ""}
      </p>

      <button
        type="submit"
        disabled={isPending}
        className="w-fit rounded-md bg-[var(--color-primary)] px-4 py-2 font-medium text-[#0b0f14] hover:bg-[var(--color-primary-hover)] disabled:opacity-50"
      >
        {isPending ? "Saving…" : submitLabel}
      </button>
    </form>
  );
}
