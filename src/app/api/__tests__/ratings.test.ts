// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * POST/DELETE /api/ratings (task 31), following `progress.test.ts`'s
 * mocking style: `requireUser()`, the queries module, the eligibility
 * module, and the mutations module are all mocked, so this exercises only
 * the route's own dispatch/validation/response shaping — never a database.
 */

const MOCK_USER = { id: "user_1", email: "ada@example.com" };
const COURSE = { id: "course_1", slug: "ai-foundations", title: "AI Foundations" };
const PATH = {
  id: "path_1",
  slug: "technical-builder-zero-knowledge",
  title: "Technical Builder — Zero Knowledge",
};
const AGGREGATE = { average: 4.5, count: 2 };
const RATING_ROW = {
  id: "rating_1",
  stars: 4,
  feedback: "Great",
  hiddenAt: null,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
};

const requireUserMock = vi.fn().mockResolvedValue(MOCK_USER);
const resolvePublishedCourseBySlugMock = vi.fn();
const resolvePublishedPathBySlugMock = vi.fn();
const getSingleCourseRatingAggregateMock = vi.fn();
const getSinglePathRatingAggregateMock = vi.fn();
const getCourseRatingEligibilityMock = vi.fn();
const getPathRatingEligibilityMock = vi.fn();
const upsertRatingMock = vi.fn();
const deleteRatingMock = vi.fn();

vi.mock("@/lib/auth/session", () => ({
  requireUser: () => requireUserMock(),
}));

vi.mock("@/lib/ratings/queries", () => ({
  resolvePublishedCourseBySlug: (...args: unknown[]) => resolvePublishedCourseBySlugMock(...args),
  resolvePublishedPathBySlug: (...args: unknown[]) => resolvePublishedPathBySlugMock(...args),
  getSingleCourseRatingAggregate: (...args: unknown[]) =>
    getSingleCourseRatingAggregateMock(...args),
  getSinglePathRatingAggregate: (...args: unknown[]) => getSinglePathRatingAggregateMock(...args),
}));

vi.mock("@/lib/ratings/eligibility", async () => {
  const actual = await vi.importActual<typeof import("../../../lib/ratings/eligibility")>(
    "../../../lib/ratings/eligibility",
  );
  return {
    RATING_ELIGIBILITY_MESSAGES: actual.RATING_ELIGIBILITY_MESSAGES,
    getCourseRatingEligibility: (...args: unknown[]) => getCourseRatingEligibilityMock(...args),
    getPathRatingEligibility: (...args: unknown[]) => getPathRatingEligibilityMock(...args),
  };
});

vi.mock("@/lib/ratings/mutations", () => ({
  upsertRating: (...args: unknown[]) => upsertRatingMock(...args),
  deleteRating: (...args: unknown[]) => deleteRatingMock(...args),
}));

function makeRequest(
  method: "POST" | "DELETE",
  body: unknown,
  { rawBody }: { rawBody?: string } = {},
) {
  return new Request("http://localhost/api/ratings", {
    method,
    headers: { "Content-Type": "application/json" },
    body: rawBody ?? JSON.stringify(body),
  });
}

beforeEach(() => {
  requireUserMock.mockReset().mockResolvedValue(MOCK_USER);
  resolvePublishedCourseBySlugMock.mockReset().mockResolvedValue(COURSE);
  resolvePublishedPathBySlugMock.mockReset().mockResolvedValue(PATH);
  getSingleCourseRatingAggregateMock.mockReset().mockResolvedValue(AGGREGATE);
  getSinglePathRatingAggregateMock.mockReset().mockResolvedValue(AGGREGATE);
  getCourseRatingEligibilityMock.mockReset().mockResolvedValue({ eligible: true });
  getPathRatingEligibilityMock.mockReset().mockResolvedValue({ eligible: true });
  upsertRatingMock.mockReset().mockResolvedValue(RATING_ROW);
  deleteRatingMock.mockReset().mockResolvedValue({ count: 1 });
});

describe("POST /api/ratings", () => {
  it("returns 400 with the standard message for malformed JSON", async () => {
    const { POST } = await import("../ratings/route");
    const response = await POST(makeRequest("POST", undefined, { rawBody: "{not json" }));

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body).toEqual({ success: false, error: "Invalid JSON body" });
    expect(upsertRatingMock).not.toHaveBeenCalled();
  });

  it("returns 400 for invalid stars", async () => {
    const { POST } = await import("../ratings/route");
    const response = await POST(
      makeRequest("POST", { targetType: "course", targetSlug: "ai-foundations", stars: 6 }),
    );

    expect(response.status).toBe(400);
    expect(upsertRatingMock).not.toHaveBeenCalled();
  });

  it("returns 404 and calls no mutation for an unknown/unpublished slug", async () => {
    resolvePublishedCourseBySlugMock.mockResolvedValue(null);
    const { POST } = await import("../ratings/route");
    const response = await POST(
      makeRequest("POST", { targetType: "course", targetSlug: "does-not-exist", stars: 4 }),
    );

    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body).toEqual({ success: false, error: "Course not found" });
    expect(upsertRatingMock).not.toHaveBeenCalled();
  });

  it("returns 403 with the eligibility copy and writes nothing for an ineligible user", async () => {
    getCourseRatingEligibilityMock.mockResolvedValue({
      eligible: false,
      reason: "COURSE_NOT_STARTED",
    });
    const { POST } = await import("../ratings/route");
    const response = await POST(
      makeRequest("POST", { targetType: "course", targetSlug: "ai-foundations", stars: 4 }),
    );

    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.reason).toBe("COURSE_NOT_STARTED");
    expect(typeof body.error).toBe("string");
    expect(upsertRatingMock).not.toHaveBeenCalled();
  });

  it("dispatches a valid course submission with the session user's id, never one from the body, and returns the aggregate", async () => {
    const { POST } = await import("../ratings/route");
    const response = await POST(
      makeRequest("POST", {
        targetType: "course",
        targetSlug: "ai-foundations",
        stars: 4,
        feedback: "Great",
        userId: "attacker-supplied-id",
      }),
    );

    expect(response.status).toBe(200);
    expect(upsertRatingMock).toHaveBeenCalledWith({
      userId: MOCK_USER.id,
      target: { courseId: COURSE.id },
      stars: 4,
      feedback: "Great",
    });
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.aggregate).toEqual(AGGREGATE);
  });

  it("dispatches a valid path submission with the session user's id and returns the aggregate", async () => {
    const { POST } = await import("../ratings/route");
    const response = await POST(
      makeRequest("POST", {
        targetType: "path",
        targetSlug: PATH.slug,
        stars: 5,
      }),
    );

    expect(response.status).toBe(200);
    expect(upsertRatingMock).toHaveBeenCalledWith({
      userId: MOCK_USER.id,
      target: { pathId: PATH.id },
      stars: 5,
      feedback: null,
    });
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.aggregate).toEqual(AGGREGATE);
  });
});

describe("DELETE /api/ratings", () => {
  it("scopes to the session user and returns the aggregate on success", async () => {
    const { DELETE } = await import("../ratings/route");
    const response = await DELETE(
      makeRequest("DELETE", { targetType: "course", targetSlug: "ai-foundations" }),
    );

    expect(response.status).toBe(200);
    expect(deleteRatingMock).toHaveBeenCalledWith({
      userId: MOCK_USER.id,
      target: { courseId: COURSE.id },
    });
    const body = await response.json();
    expect(body).toEqual({ success: true, aggregate: AGGREGATE });
  });

  it("404s on a missing row", async () => {
    deleteRatingMock.mockResolvedValue({ count: 0 });
    const { DELETE } = await import("../ratings/route");
    const response = await DELETE(
      makeRequest("DELETE", { targetType: "course", targetSlug: "ai-foundations" }),
    );

    expect(response.status).toBe(404);
  });
});
