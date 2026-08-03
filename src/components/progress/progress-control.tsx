"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { DisplayProgressStatus } from "@/lib/progress/status";

/**
 * FR-PROG-001's completion control (task 12, decision #1). A single
 * button whose label/action flips between `complete` and `reopen`
 * depending on the current status. Follows the conventions in
 * `src/components/content/path-switcher.tsx` and
 * `src/components/account/delete-account-form.tsx`: optimistic update,
 * revert + inline error on failure, disabled while pending, an
 * `aria-live="polite"` region announcing the result, and
 * `router.refresh()` on success so server-rendered percentages update.
 *
 * The item title is included in the button's accessible name so a list of
 * these controls isn't a row of identical "Mark complete" buttons for a
 * screen-reader user.
 */
export function ProgressControl({
  contentItemSlug,
  contentItemTitle,
  initialStatus,
}: {
  contentItemSlug: string;
  contentItemTitle: string;
  initialStatus: DisplayProgressStatus;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<DisplayProgressStatus>(initialStatus);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");

  const isComplete = status === "COMPLETE";
  const action = isComplete ? "reopen" : "complete";
  const label = isComplete ? "Mark as not complete" : "Mark complete";

  async function handleClick() {
    if (isPending) {
      return;
    }
    setIsPending(true);
    setError(null);

    const previousStatus = status;
    const nextStatus: DisplayProgressStatus = isComplete ? "IN_PROGRESS" : "COMPLETE";
    setStatus(nextStatus);

    const response = await fetch("/api/progress", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contentItemSlug, action }),
    });

    setIsPending(false);

    if (!response.ok) {
      setStatus(previousStatus);
      setError("Could not update your progress. Please try again.");
      setAnnouncement("Could not update your progress. Please try again.");
      return;
    }

    setAnnouncement(
      nextStatus === "COMPLETE"
        ? `Marked "${contentItemTitle}" as complete.`
        : `Marked "${contentItemTitle}" as not complete.`,
    );
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={isPending}
        aria-label={`${label}: ${contentItemTitle}`}
        className="w-fit rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-sm font-medium text-[var(--color-text)] hover:bg-[var(--color-surface-hover)] disabled:opacity-50"
      >
        {isPending ? "Saving…" : label}
      </button>
      <span role="status" aria-live="polite" className="sr-only">
        {announcement}
      </span>
      {error ? <p className="text-xs text-[var(--color-danger)]">{error}</p> : null}
    </div>
  );
}
