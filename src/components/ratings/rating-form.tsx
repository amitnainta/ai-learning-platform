"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { StarRatingInput } from "@/components/ratings/star-rating-input";
import { TextAreaField } from "@/components/ui/textarea-field";
import { FEEDBACK_MAX_LENGTH } from "@/lib/validation/rating";

/**
 * FR-RATE-001/002/003/004's submission form (task 16). Follows
 * `src/components/progress/progress-control.tsx` and
 * `src/components/account/delete-account-form.tsx`'s conventions:
 * optimistic-free (no visible state changes until the server confirms),
 * disabled while pending, an inline error on failure, an
 * `aria-live="polite"` region announcing the result, and
 * `router.refresh()` on success so the server-rendered aggregate and list
 * update. Prefills and switches to "Update your rating" when the viewer
 * already has one for this target (decision #3), and offers "Remove my
 * rating" in that case.
 */

export interface RatingFormInitialRating {
  stars: number;
  feedback: string | null;
  hiddenAt: string | Date | null;
}

export function RatingForm({
  targetType,
  targetSlug,
  prompt,
  initialRating,
}: {
  targetType: "course" | "path";
  targetSlug: string;
  prompt: string;
  initialRating: RatingFormInitialRating | null;
}) {
  const router = useRouter();
  const [stars, setStars] = useState<number | null>(initialRating?.stars ?? null);
  const [feedback, setFeedback] = useState(initialRating?.feedback ?? "");
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");

  const isUpdate = initialRating !== null;
  const isHidden = initialRating?.hiddenAt != null;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (stars === null || isPending) {
      return;
    }

    if (feedback.length > FEEDBACK_MAX_LENGTH) {
      const message = `Feedback must be ${FEEDBACK_MAX_LENGTH} characters or fewer.`;
      setError(message);
      setAnnouncement(message);
      return;
    }

    setIsPending(true);
    setError(null);

    const response = await fetch("/api/ratings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetType, targetSlug, stars, feedback }),
    });

    setIsPending(false);

    if (!response.ok) {
      const responseBody = await response.json().catch(() => ({}));
      const message = responseBody.error ?? "Could not save your rating. Please try again.";
      setError(message);
      setAnnouncement(message);
      return;
    }

    setAnnouncement(isUpdate ? "Your rating was updated." : "Your rating was submitted.");
    router.refresh();
  }

  async function handleRemove() {
    if (isPending) {
      return;
    }
    setIsPending(true);
    setError(null);

    const response = await fetch("/api/ratings", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetType, targetSlug }),
    });

    setIsPending(false);

    if (!response.ok) {
      const responseBody = await response.json().catch(() => ({}));
      const message = responseBody.error ?? "Could not remove your rating. Please try again.";
      setError(message);
      setAnnouncement(message);
      return;
    }

    setStars(null);
    setFeedback("");
    setAnnouncement("Your rating was removed.");
    router.refresh();
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-4 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-4"
    >
      <StarRatingInput
        name={`${targetType}-${targetSlug}-stars`}
        value={stars}
        onChange={setStars}
        disabled={isPending}
      />

      <TextAreaField
        label={prompt}
        name={`${targetType}-${targetSlug}-feedback`}
        value={feedback}
        onChange={(event) => setFeedback(event.target.value)}
        maxLength={FEEDBACK_MAX_LENGTH}
        rows={5}
        disabled={isPending}
        hint="Optional. Your feedback will be shown publicly, along with your name, role, and level."
      />

      {isHidden ? (
        <p className="text-xs text-[var(--color-text-muted)]">
          Your feedback is not currently shown publicly.
        </p>
      ) : null}

      <p aria-live="polite" className="min-h-[1rem] text-xs text-[var(--color-danger)]">
        {error ?? ""}
      </p>
      <span role="status" aria-live="polite" className="sr-only">
        {announcement}
      </span>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={stars === null || isPending || feedback.length > FEEDBACK_MAX_LENGTH}
          className="w-fit rounded-md bg-[var(--color-accent)] px-4 py-2 font-medium text-white disabled:opacity-50"
        >
          {isPending ? "Saving…" : isUpdate ? "Update your rating" : "Submit rating"}
        </button>
        {isUpdate ? (
          <button
            type="button"
            onClick={handleRemove}
            disabled={isPending}
            className="w-fit rounded-md border border-[var(--color-danger)] px-4 py-2 text-sm font-medium text-[var(--color-danger)] disabled:opacity-50"
          >
            Remove my rating
          </button>
        ) : null}
      </div>
    </form>
  );
}
