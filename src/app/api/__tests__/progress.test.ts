// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * `POST /api/progress` (task 26), following `export.test.ts`'s mocking
 * style: `requireUser()` and the mutation module are both mocked, so this
 * test exercises only the route's own dispatch/validation/response
 * shaping — never a database.
 */

const MOCK_USER = { id: "user_1", email: "ada@example.com" };

const requireUserMock = vi.fn().mockResolvedValue(MOCK_USER);
const resolvePublishedContentItemBySlugMock = vi.fn();
const recordViewMock = vi.fn();
const markCompleteMock = vi.fn();
const reopenMock = vi.fn();

vi.mock("@/lib/auth/session", () => ({
  requireUser: () => requireUserMock(),
}));

vi.mock("@/lib/progress/mutations", () => ({
  resolvePublishedContentItemBySlug: (...args: unknown[]) =>
    resolvePublishedContentItemBySlugMock(...args),
  recordView: (...args: unknown[]) => recordViewMock(...args),
  markComplete: (...args: unknown[]) => markCompleteMock(...args),
  reopen: (...args: unknown[]) => reopenMock(...args),
}));

const RESOLVED_ITEM = {
  id: "item_1",
  slug: "what-is-artificial-intelligence",
  sourceType: "ORIGINAL",
};
const PROGRESS_ROW = {
  status: "IN_PROGRESS",
  lastViewedAt: new Date("2026-01-01T00:00:00.000Z"),
  completedAt: null,
};

function makeRequest(body: unknown, { rawBody }: { rawBody?: string } = {}) {
  return new Request("http://localhost/api/progress", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: rawBody ?? JSON.stringify(body),
  });
}

beforeEach(() => {
  requireUserMock.mockReset().mockResolvedValue(MOCK_USER);
  resolvePublishedContentItemBySlugMock.mockReset().mockResolvedValue(RESOLVED_ITEM);
  recordViewMock.mockReset().mockResolvedValue(PROGRESS_ROW);
  markCompleteMock.mockReset().mockResolvedValue({ ...PROGRESS_ROW, status: "COMPLETE" });
  reopenMock.mockReset().mockResolvedValue(PROGRESS_ROW);
});

describe("POST /api/progress", () => {
  it("returns 400 with the standard message for malformed JSON", async () => {
    const { POST } = await import("../progress/route");
    const response = await POST(makeRequest(undefined, { rawBody: "{not json" }));

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body).toEqual({ success: false, error: "Invalid JSON body" });
    expect(resolvePublishedContentItemBySlugMock).not.toHaveBeenCalled();
  });

  it("returns 400 for an invalid action", async () => {
    const { POST } = await import("../progress/route");
    const response = await POST(
      makeRequest({ contentItemSlug: "what-is-artificial-intelligence", action: "delete" }),
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(resolvePublishedContentItemBySlugMock).not.toHaveBeenCalled();
  });

  it("returns 404 and calls no mutation for an unknown or unpublished slug", async () => {
    resolvePublishedContentItemBySlugMock.mockResolvedValue(null);
    const { POST } = await import("../progress/route");
    const response = await POST(makeRequest({ contentItemSlug: "does-not-exist", action: "view" }));

    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body).toEqual({ success: false, error: "Content item not found" });
    expect(recordViewMock).not.toHaveBeenCalled();
    expect(markCompleteMock).not.toHaveBeenCalled();
    expect(reopenMock).not.toHaveBeenCalled();
  });

  it("dispatches 'view' to recordView with the session user's id, never one from the body", async () => {
    const { POST } = await import("../progress/route");
    const response = await POST(
      makeRequest({
        contentItemSlug: "what-is-artificial-intelligence",
        action: "view",
        userId: "attacker-supplied-id",
      }),
    );

    expect(response.status).toBe(200);
    expect(recordViewMock).toHaveBeenCalledWith({
      userId: MOCK_USER.id,
      contentItemId: RESOLVED_ITEM.id,
    });
    const body = await response.json();
    expect(body).toEqual({
      success: true,
      progress: {
        status: PROGRESS_ROW.status,
        lastViewedAt: PROGRESS_ROW.lastViewedAt.toISOString(),
        completedAt: PROGRESS_ROW.completedAt,
      },
    });
  });

  it("dispatches 'complete' to markComplete with the session user's id", async () => {
    const { POST } = await import("../progress/route");
    const response = await POST(
      makeRequest({ contentItemSlug: "what-is-artificial-intelligence", action: "complete" }),
    );

    expect(response.status).toBe(200);
    expect(markCompleteMock).toHaveBeenCalledWith({
      userId: MOCK_USER.id,
      contentItemId: RESOLVED_ITEM.id,
    });
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.progress.status).toBe("COMPLETE");
  });

  it("dispatches 'reopen' to reopen with the session user's id", async () => {
    const { POST } = await import("../progress/route");
    const response = await POST(
      makeRequest({ contentItemSlug: "what-is-artificial-intelligence", action: "reopen" }),
    );

    expect(response.status).toBe(200);
    expect(reopenMock).toHaveBeenCalledWith({
      userId: MOCK_USER.id,
      contentItemId: RESOLVED_ITEM.id,
    });
    const body = await response.json();
    expect(body.success).toBe(true);
  });

  it("resolves the slug against published content only, never trusting a client-supplied id", async () => {
    const { POST } = await import("../progress/route");
    await POST(makeRequest({ contentItemSlug: "what-is-artificial-intelligence", action: "view" }));

    expect(resolvePublishedContentItemBySlugMock).toHaveBeenCalledWith(
      "what-is-artificial-intelligence",
    );
  });
});
