import { describe, expect, it, vi } from "vitest";
import { deleteRating, flagRating, upsertRating } from "../mutations";

/**
 * Mocked-Prisma-client tests (task 30), matching
 * `src/lib/progress/__tests__/mutations.test.ts`'s style: every call passes
 * its own mock explicitly, never the imported `prisma` singleton default.
 */

vi.mock("@/lib/prisma", () => ({ prisma: {} }));

function buildMockClient() {
  return {
    rating: {
      upsert: vi.fn(),
      deleteMany: vi.fn(),
    },
    ratingFlag: {
      upsert: vi.fn(),
    },
  };
}

describe("upsertRating", () => {
  it("a course submission upserts on userId_courseId with pathId absent", async () => {
    const client = buildMockClient();
    await upsertRating(
      { userId: "u1", target: { courseId: "c1" }, stars: 4, feedback: "Good" },
      client as never,
    );

    expect(client.rating.upsert).toHaveBeenCalledTimes(1);
    const call = client.rating.upsert.mock.calls[0]![0];
    expect(call.where).toEqual({ userId_courseId: { userId: "u1", courseId: "c1" } });
    expect(call.create).toEqual({ userId: "u1", courseId: "c1", stars: 4, feedback: "Good" });
    expect(call.create).not.toHaveProperty("pathId");
  });

  it("a path submission upserts on userId_pathId", async () => {
    const client = buildMockClient();
    await upsertRating(
      { userId: "u1", target: { pathId: "p1" }, stars: 5, feedback: null },
      client as never,
    );

    const call = client.rating.upsert.mock.calls[0]![0];
    expect(call.where).toEqual({ userId_pathId: { userId: "u1", pathId: "p1" } });
    expect(call.create).toEqual({ userId: "u1", pathId: "p1", stars: 5, feedback: null });
  });

  it("a repeat submission's update payload replaces stars and feedback (not a second row)", async () => {
    const client = buildMockClient();
    await upsertRating(
      { userId: "u1", target: { courseId: "c1" }, stars: 2, feedback: "changed" },
      client as never,
    );

    const call = client.rating.upsert.mock.calls[0]![0];
    expect(call.update).toEqual({ stars: 2, feedback: "changed" });
  });
});

describe("deleteRating", () => {
  it("scopes its where by the session userId", async () => {
    const client = buildMockClient();
    client.rating.deleteMany.mockResolvedValue({ count: 1 });

    await deleteRating({ userId: "u1", target: { courseId: "c1" } }, client as never);

    expect(client.rating.deleteMany).toHaveBeenCalledWith({
      where: { userId: "u1", courseId: "c1" },
    });
  });
});

describe("flagRating", () => {
  it("upserts on ratingId_userId so a second flag by the same user does not create a duplicate", async () => {
    const client = buildMockClient();
    await flagRating({ ratingId: "r1", userId: "u1", reason: "SPAM", note: null }, client as never);

    expect(client.ratingFlag.upsert).toHaveBeenCalledTimes(1);
    const call = client.ratingFlag.upsert.mock.calls[0]![0];
    expect(call.where).toEqual({ ratingId_userId: { ratingId: "r1", userId: "u1" } });
    expect(call.create).toEqual({ ratingId: "r1", userId: "u1", reason: "SPAM", note: null });
    expect(call.update).toEqual({ reason: "SPAM", note: null });
  });
});
