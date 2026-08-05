/**
 * Pure, database-free progress computation (task 5). No Prisma import —
 * mirrors `src/lib/content/plan-import.ts`'s split between "pure
 * computation" and "database write" so this module is unit-testable
 * without a database. Input types are minimal structural interfaces, not
 * Prisma types, so tests can build fixtures by hand (decision #5,
 * factory/work/progress-tracking/PLAN.md).
 *
 * The denominator for every percentage is "whatever the caller passes in"
 * — `src/lib/progress/queries.ts` (and every route) is responsible for
 * only ever passing currently-published items (it already filters
 * `status: "PUBLISHED"` at every level, same as
 * `src/lib/content/queries.ts`), so a retired item silently drops out of
 * both numerator and denominator without this module needing to know
 * anything about content status.
 */

export type ProgressItemStatus = "IN_PROGRESS" | "COMPLETE";

export interface ProgressRecord {
  status: ProgressItemStatus;
}

/** A `Map` from `ContentItem.id` to that item's progress row, or absent for "not started". */
export type ProgressByItemId = Map<string, ProgressRecord>;

export interface ProgressItem {
  id: string;
  slug: string;
  title: string;
  sourceType: "ORIGINAL" | "CURATED";
  position: number;
}

export interface ProgressCourse {
  slug: string;
  title: string;
  position: number;
  items: ProgressItem[];
}

export interface ProgressCounts {
  completedCount: number;
  totalCount: number;
  /**
   * 0 only when `completedCount === 0`, 100 only when
   * `completedCount === totalCount` (and `totalCount > 0`); otherwise
   * clamped to 1-99 so a partially complete course never rounds up to 100
   * and a partially started one never rounds down to 0 (decision #5's
   * "honest at the ends" rule — a future certificate reads 100% as
   * "finished").
   */
  percent: number;
}

function isComplete(itemId: string, progressByItemId: ProgressByItemId): boolean {
  return progressByItemId.get(itemId)?.status === "COMPLETE";
}

function hasAnyProgress(itemId: string, progressByItemId: ProgressByItemId): boolean {
  return progressByItemId.has(itemId);
}

function countsFor(itemIds: string[], progressByItemId: ProgressByItemId): ProgressCounts {
  const totalCount = itemIds.length;
  if (totalCount === 0) {
    return { completedCount: 0, totalCount: 0, percent: 0 };
  }

  const completedCount = itemIds.filter((id) => isComplete(id, progressByItemId)).length;

  let percent: number;
  if (completedCount === 0) {
    percent = 0;
  } else if (completedCount === totalCount) {
    percent = 100;
  } else {
    const raw = Math.round((completedCount / totalCount) * 100);
    percent = Math.min(99, Math.max(1, raw));
  }

  return { completedCount, totalCount, percent };
}

/** A single course's completion counts (decision #5). */
export function computeCourseProgress(
  items: ProgressItem[],
  progressByItemId: ProgressByItemId,
): ProgressCounts {
  return countsFor(
    items.map((item) => item.id),
    progressByItemId,
  );
}

/**
 * A path's completion counts, de-duplicated by `contentItemId` across its
 * courses so an item appearing in two courses of the same path is counted
 * once and the percentage can never exceed 100 (decision #5).
 */
export function computePathProgress(
  courses: ProgressCourse[],
  progressByItemId: ProgressByItemId,
): ProgressCounts {
  const uniqueItemIds = new Set<string>();
  for (const course of courses) {
    for (const item of course.items) {
      uniqueItemIds.add(item.id);
    }
  }
  return countsFor([...uniqueItemIds], progressByItemId);
}

export type ResumeTarget =
  | { kind: "start"; item: ProgressItem; course: Pick<ProgressCourse, "slug" | "title"> }
  | { kind: "resume"; item: ProgressItem; course: Pick<ProgressCourse, "slug" | "title"> }
  | { kind: "complete" }
  | { kind: "empty" };

/**
 * Resume-target selection (decision #6). Flattens `courses[].position` then
 * `items[].position` order, de-duplicates by content item (first
 * occurrence wins), and returns the first entry that is not `COMPLETE`.
 * Positional, not "most recently viewed" — a curated ordered curriculum
 * means "where they left off" is the front of the unfinished part, not
 * wherever the learner most recently clicked.
 *
 * Applying this to a single-course array (`[course]`) gives FR-PROG-002's
 * "resume a course" half for free.
 */
export function findResumeTarget(
  courses: ProgressCourse[],
  progressByItemId: ProgressByItemId,
): ResumeTarget {
  const orderedCourses = [...courses].sort((a, b) => a.position - b.position);

  const seen = new Set<string>();
  const flattened: { item: ProgressItem; course: ProgressCourse }[] = [];
  for (const course of orderedCourses) {
    const orderedItems = [...course.items].sort((a, b) => a.position - b.position);
    for (const item of orderedItems) {
      if (seen.has(item.id)) {
        continue;
      }
      seen.add(item.id);
      flattened.push({ item, course });
    }
  }

  if (flattened.length === 0) {
    return { kind: "empty" };
  }

  const nothingStarted = flattened.every(({ item }) => !hasAnyProgress(item.id, progressByItemId));

  const firstIncomplete = flattened.find(({ item }) => !isComplete(item.id, progressByItemId));

  if (!firstIncomplete) {
    return { kind: "complete" };
  }

  return {
    kind: nothingStarted ? "start" : "resume",
    item: firstIncomplete.item,
    course: { slug: firstIncomplete.course.slug, title: firstIncomplete.course.title },
  };
}
