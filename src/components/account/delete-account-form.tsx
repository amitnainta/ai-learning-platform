"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { deleteConfirmationMatches } from "@/lib/validation/account";

/**
 * Decision #2: immediate hard delete on typed confirmation. The confirm
 * button stays disabled until the typed value matches the account email
 * exactly — no trimming, no case-insensitivity.
 */
export function DeleteAccountForm({ accountEmail }: { accountEmail: string }) {
  const router = useRouter();
  const [confirmEmail, setConfirmEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  const canSubmit = deleteConfirmationMatches({ confirmEmail, accountEmail });

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit) {
      return;
    }

    setIsPending(true);
    setError(null);

    const response = await fetch("/api/account", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirmEmail }),
    });

    if (!response.ok) {
      setIsPending(false);
      const body = await response.json().catch(() => ({}));
      setError(body.error ?? "Something went wrong. Please try again.");
      return;
    }

    router.push("/account-deleted");
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex max-w-sm flex-col gap-3 rounded-md border border-[var(--color-danger)] p-4"
    >
      <p className="text-sm text-[var(--color-text)]">
        This permanently deletes your account and all associated data. This cannot be undone.
      </p>
      <label htmlFor="confirmEmail" className="text-sm font-medium text-[var(--color-text)]">
        Type <strong>{accountEmail}</strong> to confirm
      </label>
      <input
        id="confirmEmail"
        name="confirmEmail"
        type="text"
        autoComplete="off"
        value={confirmEmail}
        onChange={(event) => setConfirmEmail(event.target.value)}
        className="rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-[var(--color-text)]"
      />
      <p aria-live="polite" className="min-h-[1rem] text-xs text-[var(--color-danger)]">
        {error ?? ""}
      </p>
      <button
        type="submit"
        disabled={!canSubmit || isPending}
        className="w-fit rounded-md bg-[var(--color-danger)] px-4 py-2 font-medium text-white hover:bg-[var(--color-danger-hover)] disabled:opacity-50"
      >
        {isPending ? "Deleting…" : "Permanently delete my account"}
      </button>
    </form>
  );
}
