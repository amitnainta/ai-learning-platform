import { prisma } from "@/lib/prisma";
import { getProgressMapForUser } from "@/lib/progress/queries";
import { computePathProgress, type ProgressCourse } from "@/lib/progress/percent";

/**
 * The single FR-RATE-008 source of truth (task 7, decision #2,
 * factory/work/ratings-and-feedback/PLAN.md), called by both the page (to
 * decide whether to render a form) and `POST /api/ratings` (to decide
 * whether to accept a write) — so what the UI shows and what the endpoint
 * accepts can never disagree.
 *
 * Two fixed, named policies, not a runtime setting: a course needs only
 * "started"; a path needs "completed" (100% per `computePathProgress`,
 * reused verbatim from progress-tracking rather than reimplemented).
 */

export const COURSE_RATING_POLICY = "STARTED" as const;
export const PATH_RATING_POLICY = "COMPLETED" as const;

export type RatingIneligibleReason =
  "NOT_SIGNED_IN" | "COURSE_NOT_STARTED" | "PATH_NOT_COMPLETE" | "NO_ITEMS";

export type RatingEligibility =
  { eligible: true } | { eligible: false; reason: RatingIneligibleReason };

/** User-facing copy per ineligibility reason — the page and the form render identical wording (decision #2). */
export const RATING_ELIGIBILITY_MESSAGES: Record<RatingIneligibleReason, string> = {
  NOT_SIGNED_IN: "Sign in to rate this.",
  COURSE_NOT_STARTED: "Start this course to leave a rating and feedback.",
  PATH_NOT_COMPLETE: "Complete every item in this path to rate it.",
  NO_ITEMS: "This doesn't have any published content yet, so there's nothing to rate.",
};

/**
 * Course policy: STARTED — at least one `Progress` row exists for the user
 * against any currently-published item in the course. A course with zero
 * published items is `NO_ITEMS`, checked first so it never reports
 * `COURSE_NOT_STARTED` for something nobody could ever start.
 */
export async function getCourseRatingEligibility(
  userId: string,
  courseId: string,
): Promise<RatingEligibility> {
  const publishedItemCount = await prisma.courseItem.count({
    where: { courseId, contentItem: { status: "PUBLISHED" } },
  });
  if (publishedItemCount === 0) {
    return { eligible: false, reason: "NO_ITEMS" };
  }

  const startedCount = await prisma.progress.count({
    where: { userId, contentItem: { status: "PUBLISHED", courses: { some: { courseId } } } },
  });
  if (startedCount === 0) {
    return { eligible: false, reason: "COURSE_NOT_STARTED" };
  }

  return { eligible: true };
}

interface PathShapeForEligibility {
  courses: {
    position: number;
    course: {
      slug: string;
      title: string;
      items: {
        position: number;
        contentItem: {
          id: string;
          slug: string;
          title: string;
          sourceType: "ORIGINAL" | "CURATED";
        };
      }[];
    };
  }[];
}

function toProgressCourses(courses: PathShapeForEligibility["courses"]): ProgressCourse[] {
  return courses.map((pathCourse) => ({
    slug: pathCourse.course.slug,
    title: pathCourse.course.title,
    position: pathCourse.position,
    items: pathCourse.course.items.map((courseItem) => ({
      id: courseItem.contentItem.id,
      slug: courseItem.contentItem.slug,
      title: courseItem.contentItem.title,
      sourceType: courseItem.contentItem.sourceType,
      position: courseItem.position,
    })),
  }));
}

/**
 * Path policy: COMPLETED — `computePathProgress(...).percent === 100` over
 * currently-published items, de-duplicated across the path's courses.
 * Reuses `computePathProgress` verbatim (decision #2) rather than
 * reimplementing the "live denominator" behaviour it already has: a
 * retired item drops out of both numerator and denominator, so it can
 * never block eligibility. A path with zero currently-published items
 * (across every course) is `NO_ITEMS`, never eligible.
 */
export async function getPathRatingEligibility(
  userId: string,
  pathId: string,
): Promise<RatingEligibility> {
  const [path, progressMap] = await Promise.all([
    prisma.path.findUnique({
      where: { id: pathId },
      select: {
        courses: {
          where: { course: { status: "PUBLISHED" } },
          orderBy: { position: "asc" },
          select: {
            position: true,
            course: {
              select: {
                slug: true,
                title: true,
                items: {
                  where: { contentItem: { status: "PUBLISHED" } },
                  orderBy: { position: "asc" },
                  select: {
                    position: true,
                    contentItem: {
                      select: { id: true, slug: true, title: true, sourceType: true },
                    },
                  },
                },
              },
            },
          },
        },
      },
    }),
    getProgressMapForUser(userId),
  ]);

  const progressCourses = toProgressCourses(path?.courses ?? []);
  const progress = computePathProgress(progressCourses, progressMap);

  if (progress.totalCount === 0) {
    return { eligible: false, reason: "NO_ITEMS" };
  }
  if (progress.percent !== 100) {
    return { eligible: false, reason: "PATH_NOT_COMPLETE" };
  }
  return { eligible: true };
}
