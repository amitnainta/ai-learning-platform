"use client";

import { useRef, useState, type FormEvent } from "react";

/**
 * FR-RATE-006's report control (task 17). The trigger's accessible name
 * includes the author's display name so a list of these isn't a row of
 * identical "Report" buttons for a screen-reader user. Opens an inline
 * disclosure form (a reason radio group + optional note), moves focus into
 * it on open and back to the trigger on cancel, and collapses to "Reported
 * — thank you" (announced, and disabled) on success.
 */

const REASONS: { value: string; label: string }[] = [
  { value: "INAPPROPRIATE", label: "Inappropriate" },
  { value: "SPAM", label: "Spam" },
  { value: "OUTDATED_OR_INCORRECT", label: "Outdated or incorrect" },
  { value: "OTHER", label: "Other" },
];

export function FlagRatingButton({
  ratingId,
  authorName,
}: {
  ratingId: string;
  authorName: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const [reason, setReason] = useState<string | null>(null);
  const [note, setNote] = useState("");

  const triggerRef = useRef<HTMLButtonElement>(null);
  const firstRadioRef = useRef<HTMLInputElement>(null);

  function openForm() {
    setIsOpen(true);
    setError(null);
    // Focus moves into the form once it's in the DOM.
    requestAnimationFrame(() => firstRadioRef.current?.focus());
  }

  function cancelForm() {
    setIsOpen(false);
    setReason(null);
    setNote("");
    setError(null);
    triggerRef.current?.focus();
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!reason || isPending) {
      return;
    }
    setIsPending(true);
    setError(null);

    const response = await fetch("/api/ratings/flags", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ratingId, reason, note: note.trim() === "" ? undefined : note }),
    });

    setIsPending(false);

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      const message = body.error ?? "Could not submit your report. Please try again.";
      setError(message);
      setAnnouncement(message);
      return;
    }

    setIsOpen(false);
    setIsSubmitted(true);
    setAnnouncement("Reported — thank you.");
  }

  if (isSubmitted) {
    return (
      <p role="status" aria-live="polite" className="text-xs text-[var(--color-text-muted)]">
        Reported — thank you.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {!isOpen ? (
        <button
          ref={triggerRef}
          type="button"
          onClick={openForm}
          aria-label={`Report ${authorName}'s rating`}
          className="w-fit text-xs font-medium text-[var(--color-text-muted)] underline hover:text-[var(--color-text)]"
        >
          Report
        </button>
      ) : (
        <form
          onSubmit={handleSubmit}
          className="flex flex-col gap-3 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-3"
        >
          <fieldset className="flex flex-col gap-1">
            <legend className="text-xs font-medium text-[var(--color-text)]">
              Why are you reporting this?
            </legend>
            {REASONS.map((option, index) => (
              <label
                key={option.value}
                className="flex items-center gap-2 text-xs text-[var(--color-text)]"
              >
                <input
                  ref={index === 0 ? firstRadioRef : undefined}
                  type="radio"
                  name={`flag-reason-${ratingId}`}
                  value={option.value}
                  checked={reason === option.value}
                  onChange={() => setReason(option.value)}
                  disabled={isPending}
                />
                {option.label}
              </label>
            ))}
          </fieldset>

          <label
            htmlFor={`flag-note-${ratingId}`}
            className="text-xs font-medium text-[var(--color-text)]"
          >
            Note (optional)
          </label>
          <textarea
            id={`flag-note-${ratingId}`}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            maxLength={500}
            rows={2}
            disabled={isPending}
            className="rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1 text-xs text-[var(--color-text)]"
          />

          <p aria-live="polite" className="min-h-[1rem] text-xs text-[var(--color-danger)]">
            {error ?? ""}
          </p>

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={!reason || isPending}
              className="w-fit rounded-md bg-[var(--color-accent)] px-3 py-1 text-xs font-medium text-white disabled:opacity-50"
            >
              {isPending ? "Sending…" : "Submit report"}
            </button>
            <button
              type="button"
              onClick={cancelForm}
              disabled={isPending}
              className="w-fit rounded-md border border-[var(--color-border)] px-3 py-1 text-xs font-medium text-[var(--color-text)] disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
      <span role="status" aria-live="polite" className="sr-only">
        {announcement}
      </span>
    </div>
  );
}
