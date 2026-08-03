import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * The write half of decision #3 (`POST /api/progress`'s action vocabulary,
 * factory/work/progress-tracking/PLAN.md). Kept out of the route handler
 * so it is unit-testable with a mocked Prisma client (task 6), matching
 * `src/lib/auth/__tests__/options.test.ts`. Each function accepts a
 * `PrismaClient` explicitly (defaulting to the shared singleton) so tests
 * can pass a mock without module-level `vi.mock` gymnastics.
 */

export interface ProgressIdentity {
  userId: string;
  contentItemId: string;
}

export interface ResolvedContentItem {
  id: string;
  slug: string;
  sourceType: "ORIGINAL" | "CURATED";
}

/**
 * `view` — upsert: create at `IN_PROGRESS` if absent; if present, bump
 * `lastViewedAt` **only**. Deliberately never writes `status` on update, so
 * this can never downgrade an already-`COMPLETE` row back to
 * `IN_PROGRESS` — the entire reason the write API is an action vocabulary
 * rather than a target-status PUT (decision #3).
 */
export async function recordView(identity: ProgressIdentity, client: PrismaClient = prisma) {
  const { userId, contentItemId } = identity;
  return client.progress.upsert({
    where: { userId_contentItemId: { userId, contentItemId } },
    create: { userId, contentItemId, status: "IN_PROGRESS" },
    update: { lastViewedAt: new Date() },
  });
}

/**
 * `complete` — upsert to `COMPLETE`, stamping `completedAt` only if it is
 * not already set, so re-clicking cannot move the completion date a future
 * certificate will cite.
 */
export async function markComplete(identity: ProgressIdentity, client: PrismaClient = prisma) {
  const { userId, contentItemId } = identity;
  const now = new Date();
  const existing = await client.progress.findUnique({
    where: { userId_contentItemId: { userId, contentItemId } },
    select: { completedAt: true },
  });

  return client.progress.upsert({
    where: { userId_contentItemId: { userId, contentItemId } },
    create: { userId, contentItemId, status: "COMPLETE", completedAt: now, lastViewedAt: now },
    update: {
      status: "COMPLETE",
      completedAt: existing?.completedAt ?? now,
      lastViewedAt: now,
    },
  });
}

/** `reopen` — `COMPLETE` -> `IN_PROGRESS`, clearing `completedAt` (decision #1: completion is reversible). */
export async function reopen(identity: ProgressIdentity, client: PrismaClient = prisma) {
  const { userId, contentItemId } = identity;
  return client.progress.update({
    where: { userId_contentItemId: { userId, contentItemId } },
    data: { status: "IN_PROGRESS", completedAt: null, lastViewedAt: new Date() },
  });
}

/**
 * Resolves a client-supplied slug against published content only
 * (NFR-SEC-004) — a client cannot write a progress row against a draft,
 * retired, or nonexistent item, and no cuid is ever exposed to the client.
 */
export async function resolvePublishedContentItemBySlug(
  slug: string,
  client: PrismaClient = prisma,
): Promise<ResolvedContentItem | null> {
  return client.contentItem.findFirst({
    where: { slug, status: "PUBLISHED" },
    select: { id: true, slug: true, sourceType: true },
  });
}
