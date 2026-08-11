import type { RatingAggregate } from "@/lib/ratings/aggregate";
import { formatAggregate } from "@/lib/ratings/aggregate";

/**
 * FR-RATE-005's read-only aggregate display (task 15). Decorative
 * `aria-hidden` star glyphs plus the visible text from `formatAggregate`
 * (NFR-A11Y-002: the value is always available as text, never by glyph
 * shape or colour alone); the formatted `ariaText` is the wrapper's
 * accessible name. Renders the "Not yet rated" variant at count 0. Reused
 * at a smaller size on course cards and for a single list entry's stars.
 */

function filledStarCount(average: number | null): number {
  if (average === null) {
    return 0;
  }
  return Math.round(average);
}

export function StarRatingDisplay({
  aggregate,
  size = "default",
}: {
  aggregate: RatingAggregate;
  size?: "default" | "compact";
}) {
  const { text, ariaText } = formatAggregate(aggregate);
  const filled = filledStarCount(aggregate.average);
  const starSizeClass = size === "compact" ? "text-sm" : "text-base";

  return (
    <div role="img" aria-label={ariaText} className="flex items-center gap-2">
      <span aria-hidden="true" className={`${starSizeClass} text-[var(--color-accent)]`}>
        {[1, 2, 3, 4, 5].map((star) => (star <= filled ? "★" : "☆")).join("")}
      </span>
      <span
        className={
          size === "compact"
            ? "text-xs text-[var(--color-text-muted)]"
            : "text-sm text-[var(--color-text-muted)]"
        }
      >
        {text}
      </span>
    </div>
  );
}
