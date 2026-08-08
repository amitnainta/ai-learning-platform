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
 * error or creating a duplicate row.
 */
export async function flagRating(input: FlagRatingInput, client: PrismaClient = prisma) {
  const { ratingId, userId, reason, note } = input;
  return client.ratingFlag.upsert({
    where: { ratingId_userId: { ratingId, userId } },
    create: { ratingId, userId, reason, note },
    update: { reason, note },
  });
}
