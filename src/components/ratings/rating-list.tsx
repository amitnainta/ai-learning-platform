import type { RatingListEntry } from "@/lib/ratings/queries";
import { StarRatingDisplay } from "@/components/ratings/star-rating-display";
import { FlagRatingButton } from "@/components/ratings/flag-rating-button";
import { ROLE_ARCHETYPE_LABELS, PROFICIENCY_LEVEL_LABELS } from "@/lib/content/taxonomy";

/**
 * The public feedback list (task 18, decision #4). Each entry shows the
 * author's display name, role archetype + level (FR-RATE-004's framing),
 * the date, the entry's own stars, and the feedback text rendered as
 * **plain text in a `whitespace-pre-line` element** — never
 * `<Markdown>`, never `dangerouslySetInnerHTML` (decision #7, NFR-SEC-007).
 * React's default JSX interpolation escapes the text, so a hostile payload
 * (e.g. `<script>`) renders as literal visible characters, not markup.
 *
 * `<FlagRatingButton>` renders only for a signed-in viewer who is not the
 * entry's author. `listVisibleRatings` (src/lib/ratings/queries.ts)
 * deliberately selects no `userId` for any entry (name/role/level only),
 * so authorship is decided by comparing the entry's **rating id** against
 * the viewer's own rating id for this target (`currentUserRatingId`,
 * already fetched once by the page via `getMyRating` for the form) rather
 * than by exposing every author's id to the client.
 */

function formatEntryDate(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  }).format(date);
}

export function RatingList({
  result,
  isSignedIn,
  currentUserRatingId,
}: {
  result: { entries: RatingListEntry[]; totalWithFeedback: number };
  isSignedIn: boolean;
  currentUserRatingId?: string | null;
}) {
  const { entries, totalWithFeedback } = result;

  if (entries.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col gap-4">
      <h3 className="text-sm font-medium text-[var(--color-text)]">Feedback</h3>
      <ul className="flex flex-col gap-4">
        {entries.map((entry) => {
          const roleLabel = entry.author.roleArchetype
            ? ROLE_ARCHETYPE_LABELS[entry.author.roleArchetype]
            : null;
          const levelLabel = entry.author.level
            ? PROFICIENCY_LEVEL_LABELS[entry.author.level]
            : null;
          const isOwnEntry = currentUserRatingId != null && currentUserRatingId === entry.id;
          const canFlag = isSignedIn && !isOwnEntry;

          return (
            <li
              key={entry.id}
              className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-medium text-[var(--color-text)]">
                    {entry.author.name}
                  </p>
                  <p className="text-xs text-[var(--color-text-muted)]">
                    {[roleLabel, levelLabel].filter(Boolean).join(" · ")}
                    {roleLabel || levelLabel ? " · " : ""}
                    {formatEntryDate(entry.createdAt)}
                  </p>
                </div>
                <StarRatingDisplay aggregate={{ average: entry.stars, count: 1 }} size="compact" />
              </div>
              <p className="mt-2 text-sm whitespace-pre-line text-[var(--color-text)]">
                {entry.feedback}
              </p>
              {canFlag ? (
                <div className="mt-2">
                  <FlagRatingButton ratingId={entry.id} authorName={entry.author.name} />
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
      {totalWithFeedback > entries.length ? (
        <p className="text-xs text-[var(--color-text-muted)]">
          Showing {entries.length} of {totalWithFeedback}
        </p>
      ) : null}
    </div>
  );
}
