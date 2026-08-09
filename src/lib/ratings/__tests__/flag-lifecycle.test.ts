import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * End-to-end regression coverage for fix-pass B1: a rating flag that was
 * already resolved (dismissed) and is then re-reported by the *same* user
 * must genuinely reopen the moderation queue entry, not silently vanish
 * behind `listUnresolvedFlagsGroupedByRating`'s `resolvedAt: null` filter.
 *
 * `mutations.test.ts` asserts the shape of the `upsert` call in isolation;
 * this test exercises `flagRating` + `dismissRatingFlags` (mutations.ts)
 * together with `listUnresolvedFlagsGroupedByRating` (queries.ts) against a
 * small in-memory fake of the `ratingFlag` table, so it proves the fixed
 * upsert shape actually produces the promised queue-visibility behaviour end
 * to end, not just that the call arguments look right.
 */

interface FakeFlagRow {
  id: string;
  ratingId: string;
  userId: string;
  reason: string;
  note: string | null;
  resolvedAt: Date | null;
  createdAt: Date;
}

const RATING_META = {
  "rating-1": {
    id: "rating-1",
    stars: 2,
    feedback: "Not great",
    hiddenAt: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    course: { slug: "example-course", title: "Example Course" },
    path: null,
  },
} as const;

let flags: FakeFlagRow[] = [];
let nextId = 1;

vi.mock("@/lib/prisma", () => ({
  prisma: {
    ratingFlag: {
      upsert: vi.fn(async ({ where, create, update }: any) => {
        const { ratingId, userId } = where.ratingId_userId;
        const existing = flags.find((f) => f.ratingId === ratingId && f.userId === userId);
        if (existing) {
          Object.assign(existing, update);
          return existing;
        }
        const row: FakeFlagRow = {
          id: `flag-${nextId++}`,
          resolvedAt: null,
          createdAt: new Date(),
          ...create,
        };
        flags.push(row);
        return row;
      }),
      updateMany: vi.fn(async ({ where, data }: any) => {
        const matching = flags.filter(
          (f) => f.ratingId === where.ratingId && f.resolvedAt === where.resolvedAt,
        );
        matching.forEach((f) => Object.assign(f, data));
        return { count: matching.length };
      }),
      findMany: vi.fn(async ({ where }: any) => {
        return flags
          .filter((f) => f.resolvedAt === where.resolvedAt)
          .map((f) => ({
            reason: f.reason,
            note: f.note,
            rating: RATING_META[f.ratingId as keyof typeof RATING_META],
          }));
      }),
    },
  },
}));

beforeEach(() => {
  flags = [];
  nextId = 1;
});

describe("re-reporting a resolved flag (fix-pass B1)", () => {
  it("reaches the moderation queue again after the earlier flag from the same reporter was dismissed", async () => {
    const { flagRating, dismissRatingFlags } = await import("../mutations");
    const { listUnresolvedFlagsGroupedByRating } = await import("../queries");

    // 1. Reporter A flags the rating; it shows up in the queue.
    await flagRating({ ratingId: "rating-1", userId: "user-a", reason: "SPAM", note: "spammy" });

    let queue = await listUnresolvedFlagsGroupedByRating();
    expect(queue).toHaveLength(1);
    expect(queue[0]!.ratingId).toBe("rating-1");

    // 2. A moderator reviews it and dismisses it (reviewed, no action needed).
    await dismissRatingFlags("rating-1");

    queue = await listUnresolvedFlagsGroupedByRating();
    expect(queue).toHaveLength(0);

    // 3. The same reporter reports the same rating again later (e.g. it was
    //    edited into something newly problematic).
    await flagRating({
      ratingId: "rating-1",
      userId: "user-a",
      reason: "OUTDATED_OR_INCORRECT",
      note: "now wrong",
    });

    // 4. The repeat report must genuinely reach the queue again, not be
    //    silently swallowed by the stale `resolvedAt` from step 2.
    queue = await listUnresolvedFlagsGroupedByRating();
    expect(queue).toHaveLength(1);
    expect(queue[0]!.ratingId).toBe("rating-1");
    expect(queue[0]!.reasons).toEqual(["OUTDATED_OR_INCORRECT"]);
  });
});
