import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { ratingRemovalSchema, ratingSubmissionSchema } from "@/lib/validation/rating";
import {
  getCourseRatingEligibility,
  getPathRatingEligibility,
  RATING_ELIGIBILITY_MESSAGES,
} from "@/lib/ratings/eligibility";
import {
  getSingleCourseRatingAggregate,
  getSinglePathRatingAggregate,
  resolvePublishedCourseBySlug,
  resolvePublishedPathBySlug,
} from "@/lib/ratings/queries";
import { deleteRating, upsertRating, type RatingTarget } from "@/lib/ratings/mutations";

/**
 * POST/DELETE /api/ratings (task 10). FR-RATE-001/002/003/004/008,
 * NFR-SEC-004: every write is attributed to the session user
 * (`requireUser()`), addresses its target by slug resolved against
 * published content only, and re-checks eligibility server-side — the same
 * check `<RatingSection>` uses to decide whether to render the form at all
 * (decision #2), so the UI and the API can never disagree.
 */

async function resolveTarget(
  targetType: "course" | "path",
  targetSlug: string,
): Promise<{ target: RatingTarget; title: string } | null> {
  if (targetType === "course") {
    const course = await resolvePublishedCourseBySlug(targetSlug);
    return course ? { target: { courseId: course.id }, title: course.title } : null;
  }
  const path = await resolvePublishedPathBySlug(targetSlug);
  return path ? { target: { pathId: path.id }, title: path.title } : null;
}

async function checkEligibility(userId: string, target: RatingTarget) {
  return "courseId" in target
    ? getCourseRatingEligibility(userId, target.courseId)
    : getPathRatingEligibility(userId, target.pathId);
}

async function currentAggregate(target: RatingTarget) {
  return "courseId" in target
    ? getSingleCourseRatingAggregate(target.courseId)
    : getSinglePathRatingAggregate(target.pathId);
}

export async function POST(request: Request) {
  const user = await requireUser();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = ratingSubmissionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 },
    );
  }

  const resolved = await resolveTarget(parsed.data.targetType, parsed.data.targetSlug);
  if (!resolved) {
    return NextResponse.json(
      {
        success: false,
        error: parsed.data.targetType === "course" ? "Course not found" : "Path not found",
      },
      { status: 404 },
    );
  }

  const eligibility = await checkEligibility(user.id, resolved.target);
  if (!eligibility.eligible) {
    return NextResponse.json(
      {
        success: false,
        error: RATING_ELIGIBILITY_MESSAGES[eligibility.reason],
        reason: eligibility.reason,
      },
      { status: 403 },
    );
  }

  const rating = await upsertRating({
    userId: user.id,
    target: resolved.target,
    stars: parsed.data.stars,
    feedback: parsed.data.feedback,
  });
  const aggregate = await currentAggregate(resolved.target);

  return NextResponse.json({
    success: true,
    rating: {
      id: rating.id,
      stars: rating.stars,
      feedback: rating.feedback,
      hiddenAt: rating.hiddenAt,
      createdAt: rating.createdAt,
      updatedAt: rating.updatedAt,
    },
    aggregate,
  });
}

export async function DELETE(request: Request) {
  const user = await requireUser();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = ratingRemovalSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 },
    );
  }

  const resolved = await resolveTarget(parsed.data.targetType, parsed.data.targetSlug);
  if (!resolved) {
    return NextResponse.json(
      {
        success: false,
        error: parsed.data.targetType === "course" ? "Course not found" : "Path not found",
      },
      { status: 404 },
    );
  }

  const result = await deleteRating({ userId: user.id, target: resolved.target });
  if (result.count === 0) {
    return NextResponse.json({ success: false, error: "Rating not found" }, { status: 404 });
  }

  const aggregate = await currentAggregate(resolved.target);
  return NextResponse.json({ success: true, aggregate });
}
