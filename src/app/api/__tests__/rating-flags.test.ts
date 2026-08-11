// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * POST /api/ratings/flags (task 32). `requireUser()`, Prisma, and the
 * mutations module are all mocked — this exercises only the route's own
 * dispatch/validation/response shaping.
 */

const MOCK_USER = { id: "user_1", email: "ada@example.com" };
const OTHER_RATING = { id: "rating_1", userId: "user_2" };

const requireUserMock = vi.fn().mockResolvedValue(MOCK_USER);
const ratingFindFirstMock = vi.fn();
const flagRatingMock = vi.fn();

vi.mock("@/lib/auth/session", () => ({
  requireUser: () => requireUserMock(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    rating: { findFirst: (...args: unknown[]) => ratingFindFirstMock(...args) },
  },
}));

vi.mock("@/lib/ratings/mutations", () => ({
  flagRating: (...args: unknown[]) => flagRatingMock(...args),
}));

function makeRequest(body: unknown, { rawBody }: { rawBody?: string } = {}) {
  return new Request("http://localhost/api/ratings/flags", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: rawBody ?? JSON.stringify(body),
  });
}

beforeEach(() => {
  requireUserMock.mockReset().mockResolvedValue(MOCK_USER);
  ratingFindFirstMock.mockReset().mockResolvedValue(OTHER_RATING);
  flagRatingMock.mockReset().mockResolvedValue({ id: "flag_1" });
});

describe("POST /api/ratings/flags", () => {
  it("returns 400 with the standard message for malformed JSON", async () => {
    const { POST } = await import("../ratings/flags/route");
    const response = await POST(makeRequest(undefined, { rawBody: "{not json" }));
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body).toEqual({ success: false, error: "Invalid JSON body" });
    expect(flagRatingMock).not.toHaveBeenCalled();
  });

  it("returns 400 for an invalid reason", async () => {
    const { POST } = await import("../ratings/flags/route");
    const response = await POST(makeRequest({ ratingId: "rating1", reason: "NOT_A_REASON" }));
    expect(response.status).toBe(400);
    expect(flagRatingMock).not.toHaveBeenCalled();
  });

  it("returns 404 for an unknown or hidden rating id", async () => {
    ratingFindFirstMock.mockResolvedValue(null);
    const { POST } = await import("../ratings/flags/route");
    const response = await POST(makeRequest({ ratingId: "unknownrating1", reason: "SPAM" }));
    expect(response.status).toBe(404);
    expect(flagRatingMock).not.toHaveBeenCalled();
  });

  it("filters hiddenAt: null when resolving the rating", async () => {
    const { POST } = await import("../ratings/flags/route");
    await POST(makeRequest({ ratingId: "rating1", reason: "SPAM" }));
    expect(ratingFindFirstMock).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "rating1", hiddenAt: null } }),
    );
  });

  it("returns 400 and writes nothing when flagging your own rating", async () => {
    ratingFindFirstMock.mockResolvedValue({ id: "rating_1", userId: MOCK_USER.id });
    const { POST } = await import("../ratings/flags/route");
    const response = await POST(makeRequest({ ratingId: "rating1", reason: "SPAM" }));

    expect(response.status).toBe(400);
    expect(flagRatingMock).not.toHaveBeenCalled();
  });

  it("succeeds on someone else's rating and always attributes the flag to the session user", async () => {
    const { POST } = await import("../ratings/flags/route");
    const response = await POST(
      makeRequest({
        ratingId: "rating1",
        reason: "SPAM",
        note: "looks fake",
        userId: "attacker-id",
      }),
    );

    expect(response.status).toBe(200);
    expect(flagRatingMock).toHaveBeenCalledWith({
      ratingId: OTHER_RATING.id,
      userId: MOCK_USER.id,
      reason: "SPAM",
      note: "looks fake",
    });
    const body = await response.json();
    expect(body).toEqual({ success: true });
  });
});
