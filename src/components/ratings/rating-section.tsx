import Link from "next/link";
import type { CurrentUser } from "@/lib/auth/session";
import type { RatingAggregate } from "@/lib/ratings/aggregate";
import { StarRatingDisplay } from "@/components/ratings/star-rating-display";
import { RatingForm } from "@/components/ratings/rating-form";
import { RatingList } from "@/components/ratings/rating-list";
import { getMyRating, listVisibleRatings } from "@/lib/ratings/queries";
import {
  getCourseRatingEligibility,
  getPathRatingEligibility,
  RATING_ELIGIBILITY_MESSAGES,
} from "@/lib/ratings/eligibility";

/**
 * Composes the whole ratings surface for one target (task 19) — heading,
 * aggregate, then either the form (eligible or already rated), the
 * matching `RATING_ELIGIBILITY_MESSAGES` copy (signed in, not eligible), or
 * a sign-in link carrying `?next=` (anonymous, FR-ACC-008) — then the
 * public feedback list. Used identically by the course page and the path
 * page so the two surfaces cannot diverge (same rationale as
 * `<CourseSummary>`).
 *
 * Eligibility is evaluated at **write** time only (decision #2, Risks #6):
 * a viewer who already has a rating for this target always sees the form
 * in "update" mode, even if they would no longer pass the eligibility
 * check today (e.g. a path that later gained an item).
 */
export async function RatingSection({
  targetType,
  targetId,
  targetSlug,
  nextPath,
  heading,
  prompt,
  aggregate,
  user,
}: {
  targetType: "course" | "path";
  targetId: string;
  targetSlug: string;
  nextPath: string;
  heading: string;
  prompt: string;
  aggregate: RatingAggregate;
  user: CurrentUser | null;
}) {
  const target = targetType === "course" ? { courseId: targetId } : { pathId: targetId };

  const [myRating, listResult] = await Promise.all([
    user ? getMyRating(user.id, target) : Promise.resolve(null),
    listVisibleRatings(target),
  ]);

  const eligibility =
    user && !myRating
      ? targetType === "course"
        ? await getCourseRatingEligibility(user.id, targetId)
        : await getPathRatingEligibility(user.id, targetId)
      : null;

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-medium text-[var(--color-text)]">{heading}</h2>
        <StarRatingDisplay aggregate={aggregate} />
      </div>

      {user ? (
        myRating || eligibility?.eligible ? (
          <RatingForm
            targetType={targetType}
            targetSlug={targetSlug}
            prompt={prompt}
            initialRating={myRating}
          />
        ) : (
          <p className="text-sm text-[var(--color-text-muted)]">
            {eligibility ? RATING_ELIGIBILITY_MESSAGES[eligibility.reason] : ""}
          </p>
        )
      ) : (
        <p className="text-sm text-[var(--color-text-muted)]">
          <Link href={`/sign-in?next=${encodeURIComponent(nextPath)}`} className="underline">
            Sign in
          </Link>{" "}
          to rate this and leave feedback.
        </p>
      )}

      <RatingList
        result={listResult}
        isSignedIn={Boolean(user)}
        currentUserRatingId={myRating?.id}
      />
    </section>
  );
}
