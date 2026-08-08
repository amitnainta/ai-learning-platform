/**
 * Pure, database-free aggregate formatting (task 6). No Prisma import —
 * mirrors `src/lib/progress/percent.ts`'s split between "pure computation"
 * and "database write" so this module is unit-testable without a database
 * (decision #6, factory/work/ratings-and-feedback/PLAN.md). The `groupBy`
 * itself lives in `src/lib/ratings/queries.ts`; this module only knows how
 * to round and format the result it returns.
 */

export interface RatingAggregate {
  average: number | null;
  count: number;
}

export const EMPTY_AGGREGATE: RatingAggregate = { average: null, count: 0 };

/**
 * Rounds to one decimal place, half-up (e.g. 4.25 -> 4.3), matching the
 * "average rating (one decimal)" wording in FR-RATE-005.
 */
export function roundAverage(average: number): number {
  return Math.round(average * 10) / 10;
}

export interface FormattedAggregate {
  /** Visible text — never depends on colour or glyph shape alone (NFR-A11Y-002). */
  text: string;
  /** The accessible name for the aggregate's wrapper element. */
  ariaText: string;
}

function pluralizeRatings(count: number): string {
  return count === 1 ? "1 rating" : `${count} ratings`;
}

/**
 * Formats a `RatingAggregate` for display. "Not yet rated" at count 0;
 * otherwise "4.3 out of 5 - 12 ratings" / "Average rating 4.3 out of 5,
 * from 12 ratings".
 */
export function formatAggregate(aggregate: RatingAggregate): FormattedAggregate {
  if (aggregate.count === 0 || aggregate.average === null) {
    return { text: "Not yet rated", ariaText: "Not yet rated" };
  }

  const rounded = roundAverage(aggregate.average);
  const ratingsLabel = pluralizeRatings(aggregate.count);

  return {
    text: `${rounded} out of 5 - ${ratingsLabel}`,
    ariaText: `Average rating ${rounded} out of 5, from ${ratingsLabel}`,
  };
}
