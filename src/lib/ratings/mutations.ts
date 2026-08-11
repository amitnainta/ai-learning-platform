import type { PrismaClient, RatingFlagReason } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * The write half of ratings (task 9), mirroring
 * `src/lib/progress/mutations.ts`: each function accepts a `PrismaClient`
 * explicitly (defaulting to the shared singleton) so it is unit-testable
 * with a mocked client, no module-level `vi.mock` gymnastics required.
 */

export type RatingTarget = { courseId: string } | { pathId: string };

export interface UpsertRatingInput {
  userId: string;
  target: RatingTarget;
  stars: number;
  feedback: string | null;
}

/**
 * Create-or-update on the target-specific compound unique
 * (`userId_courseId` or `userId_pathId`, decision #1) — submitting again
 * replaces the stars/feedback and bumps `updatedAt` rather than creating a
 * second row (decision #3).
 */
export async function upsertRating(input: UpsertRatingInput, client: PrismaClient = prisma) {
  const { userId, target, stars, feedback } = input;

  if ("courseId" in target) {
    return client.rating.upsert({
      where: { userId_courseId: { userId, courseId: target.courseId } },
      create: { userId, courseId: target.courseId, stars, feedback },
      update: { stars, feedback },
    });
  }

  return client.rating.upsert({
    where: { userId_pathId: { userId, pathId: target.pathId } },
    create: { userId, pathId: target.pathId, stars, feedback },
    update: { stars, feedback },
  });
}

export interface DeleteRatingInput {
  userId: string;
  target: RatingTarget;
}

/**
 * Removes the session user's own rating (decision #3 — no soft delete).
 * Scoped by `userId` in the `where` so a `deleteMany` never touches another
 * user's row; a missing row deletes zero and the route maps that to 404
 * (NFR-SEC-004).
 */
export async function deleteRating(
  input: DeleteRatingInput,
  client: PrismaClient = prisma,
): Promise<{ count: number }> {
  const { userId, target } = input;
  return client.rating.deleteMany({ where: { userId, ...target } });
}

export interface FlagRatingInput {
  ratingId: string;
  userId: string;
  reason: RatingFlagReason;
  note: string | null;
}

/**
 * Upserts on `ratingId_userId` (decision #5) so a repeat report by the same
 * user updates the reason/note rather than throwing a unique-constraint
 * error or creating a duplicate row. The `update` branch also resets
 * `resolvedAt` to `null`: without that, a reporter whose earlier flag was
 * already resolved (hidden or dismissed) and who reports the same rating
 * again would silently write a row that `listUnresolvedFlagsGroupedByRating`
 * excludes forever, even though the API told them the report succeeded
 * (fix-pass B1). A repeat report must genuinely reopen the queue entry.
 */
export async function flagRating(input: FlagRatingInput, client: PrismaClient = prisma) {
  const { ratingId, userId, reason, note } = input;
  return client.ratingFlag.upsert({
    where: { ratingId_userId: { ratingId, userId } },
    create: { ratingId, userId, reason, note },
    update: { reason, note, resolvedAt: null },
  });
}

/**
 * Moderation writes (decision #5) — called only by `scripts/moderation.ts`,
 * never by the public API. `hideRating` also resolves that rating's
 * still-unresolved flags in the same call (task 23: "hide ... resolves that
 * rating's flags") so the queue drains as a side effect of acting on it.
 */
export async function hideRating(
  input: { ratingId: string; reason: string },
  client: PrismaClient = prisma,
) {
  const { ratingId, reason } = input;
  const [rating] = await client.$transaction([
    client.rating.update({
      where: { id: ratingId },
      data: { hiddenAt: new Date(), hiddenReason: reason },
    }),
    client.ratingFlag.updateMany({
      where: { ratingId, resolvedAt: null },
      data: { resolvedAt: new Date() },
    }),
  ]);
  return rating;
}

/** Clears `hiddenAt`/`hiddenReason` — the rating reappears in the public list and the aggregate. */
export async function unhideRating(ratingId: string, client: PrismaClient = prisma) {
  return client.rating.update({
    where: { id: ratingId },
    data: { hiddenAt: null, hiddenReason: null },
  });
}

/** Resolves a rating's unresolved flags without hiding it — the "reviewed, no action needed" outcome. */
export async function dismissRatingFlags(
  ratingId: string,
  client: PrismaClient = prisma,
): Promise<{ count: number }> {
  return client.ratingFlag.updateMany({
    where: { ratingId, resolvedAt: null },
    data: { resolvedAt: new Date() },
  });
}
