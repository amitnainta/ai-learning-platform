"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import type { ProficiencyLevel, RoleArchetype } from "@prisma/client";
import { PROFICIENCY_LEVEL_LABELS } from "@/lib/content/taxonomy";
import { pathUrl } from "@/lib/content/routes";

/**
 * FR-PATH-009: role and level selects plus a submit action (task 22). For
 * a signed-in user, submitting `PATCH`es `/api/account/profile` (reusing
 * the existing route and `profileSchema` from the auth item) and then
 * navigates to the new path; an anonymous visitor just navigates — there's
 * no profile to persist. Announces the outcome in an `aria-live` region
 * and follows the existing form conventions (labelled inputs,
 * disabled/pending state — see `src/components/auth/sign-up-form.tsx`).
 */

export interface PathSwitcherRoleOption {
  role: RoleArchetype;
  label: string;
}

export function PathSwitcher({
  roles,
  currentRole,
  currentLevel,
  isSignedIn,
}: {
  roles: PathSwitcherRoleOption[];
  currentRole: RoleArchetype | null;
  currentLevel: ProficiencyLevel | null;
  isSignedIn: boolean;
}) {
  const router = useRouter();
  const defaultRole = currentRole ?? roles[0]?.role;
  const [role, setRole] = useState<RoleArchetype | undefined>(defaultRole);
  const [level, setLevel] = useState<ProficiencyLevel>(currentLevel ?? "ZERO_KNOWLEDGE");
  const [status, setStatus] = useState<"idle" | "pending" | "error">("idle");
  const [message, setMessage] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!role) {
      return;
    }
    setStatus("pending");
    setMessage("");

    if (isSignedIn) {
      const response = await fetch("/api/account/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roleArchetype: role, level }),
      });

      if (!response.ok) {
        setStatus("error");
        setMessage("Could not update your path. Please try again.");
        return;
      }
    }

    setStatus("idle");
    setMessage("Switched path — redirecting…");
    router.push(pathUrl(role, level));
    router.refresh();
  }

  if (roles.length === 0 || !role) {
    return null;
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3 text-sm">
      <div className="flex flex-col gap-1">
        <label htmlFor="path-switcher-role" className="font-medium text-[var(--color-text)]">
          Role
        </label>
        <select
          id="path-switcher-role"
          name="role"
          value={role}
          onChange={(event) => setRole(event.target.value as RoleArchetype)}
          className="rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1.5 text-[var(--color-text)]"
        >
          {roles.map((option) => (
            <option key={option.role} value={option.role}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="path-switcher-level" className="font-medium text-[var(--color-text)]">
          Level
        </label>
        <select
          id="path-switcher-level"
          name="level"
          value={level}
          onChange={(event) => setLevel(event.target.value as ProficiencyLevel)}
          className="rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1.5 text-[var(--color-text)]"
        >
          {Object.entries(PROFICIENCY_LEVEL_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>
      <button
        type="submit"
        disabled={status === "pending"}
        className="rounded-md bg-[var(--color-primary)] px-3 py-1.5 font-medium text-[#0b0f14] hover:bg-[var(--color-primary-hover)] disabled:opacity-50"
      >
        {status === "pending" ? "Switching…" : "Switch path"}
      </button>
      <span role="status" aria-live="polite" className="sr-only">
        {message}
      </span>
      {status === "error" ? (
        <span className="text-xs text-[var(--color-danger)]">{message}</span>
      ) : null}
    </form>
  );
}
