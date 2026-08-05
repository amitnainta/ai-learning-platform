import { describe, expect, it, vi } from "vitest";
import { markComplete, recordView, reopen, resolvePublishedContentItemBySlug } from "../mutations";

/**
 * Mocked-Prisma-client tests (task 24), matching the style of
 * `src/lib/auth/__tests__/options.test.ts`: a hand-built fake with just
 * the methods each mutation calls, so these never touch a database. Every
 * call below passes its own mock explicitly and never relies on the
 * imported `prisma` singleton default — `@/lib/prisma` is still mocked here
 * (matching `src/app/api/account/__tests__/export.test.ts`) purely so
 * importing `../mutations` doesn't construct a real `PrismaClient` (which
 * validates `DATABASE_URL`/`DIRECT_URL` at import time) in an environment
 * that hasn't set those variables.
 */

vi.mock("@/lib/prisma", () => ({ prisma: {} }));

// Deliberately untyped as `PrismaClient` (a `never` cast is used only at
// each call site below, where a real mutation function is invoked) so
// `client.progress.upsert.mock.calls` etc. stay type-checkable in this
// file's own assertions.
function buildMockClient() {
  return {
    progress: {
      upsert: vi.fn(),
      update: vi.fn(),
      findUnique: vi.fn(),
    },
    contentItem: {
      findFirst: vi.fn(),
    },
  };
}

describe("recordView", () => {
  it("upserts, creating at IN_PROGRESS and never touching status on update", async () => {
    const client = buildMockClient();
    await recordView({ userId: "u1", contentItemId: "c1" }, client as never);

    expect(client.progress.upsert).toHaveBeenCalledTimes(1);
    const call = client.progress.upsert.mock.calls[0]![0];
    expect(call.where).toEqual({ userId_contentItemId: { userId: "u1", contentItemId: "c1" } });
    expect(call.create).toMatchObject({ userId: "u1", contentItemId: "c1", status: "IN_PROGRESS" });
    expect(call.update).not.toHaveProperty("status");
    expect(call.update).toHaveProperty("lastViewedAt");
  });

  it("on an existing COMPLETE row, the update payload cannot downgrade status (no status key at all)", async () => {
    const client = buildMockClient();
    client.progress.upsert.mockResolvedValue({ status: "COMPLETE" });
    const result = await recordView({ userId: "u1", contentItemId: "c1" }, client as never);

    const call = client.progress.upsert.mock.calls[0]![0];
    expect(Object.keys(call.update)).toEqual(["lastViewedAt"]);
    expect(result).toEqual({ status: "COMPLETE" });
  });
});

describe("markComplete", () => {
  it("stamps completedAt when the row has none yet", async () => {
    const client = buildMockClient();
    client.progress.findUnique.mockResolvedValue(null);
    await markComplete({ userId: "u1", contentItemId: "c1" }, client as never);

    const call = client.progress.upsert.mock.calls[0]![0];
    expect(call.create.status).toBe("COMPLETE");
    expect(call.create.completedAt).toBeInstanceOf(Date);
    expect(call.update.status).toBe("COMPLETE");
    expect(call.update.completedAt).toBeInstanceOf(Date);
  });

  it("leaves an existing completedAt untouched on a repeat call", async () => {
    const client = buildMockClient();
    const originalCompletedAt = new Date("2026-01-01T00:00:00.000Z");
    client.progress.findUnique.mockResolvedValue({ completedAt: originalCompletedAt });
    await markComplete({ userId: "u1", contentItemId: "c1" }, client as never);

    const call = client.progress.upsert.mock.calls[0]![0];
    expect(call.update.completedAt).toBe(originalCompletedAt);
  });
});

describe("reopen", () => {
  it("sets status back to IN_PROGRESS and nulls completedAt", async () => {
    const client = buildMockClient();
    await reopen({ userId: "u1", contentItemId: "c1" }, client as never);

    expect(client.progress.update).toHaveBeenCalledTimes(1);
    const call = client.progress.update.mock.calls[0]![0];
    expect(call.where).toEqual({ userId_contentItemId: { userId: "u1", contentItemId: "c1" } });
    expect(call.data.status).toBe("IN_PROGRESS");
    expect(call.data.completedAt).toBeNull();
  });
});

describe("resolvePublishedContentItemBySlug", () => {
  it("queries with status: PUBLISHED and the given slug", async () => {
    const client = buildMockClient();
    client.contentItem.findFirst.mockResolvedValue({
      id: "c1",
      slug: "my-lesson",
      sourceType: "ORIGINAL",
    });

    const result = await resolvePublishedContentItemBySlug("my-lesson", client as never);

    expect(client.contentItem.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { slug: "my-lesson", status: "PUBLISHED" } }),
    );
    expect(result).toEqual({ id: "c1", slug: "my-lesson", sourceType: "ORIGINAL" });
  });

  it("returns null for an unknown slug", async () => {
    const client = buildMockClient();
    client.contentItem.findFirst.mockResolvedValue(null);

    const result = await resolvePublishedContentItemBySlug("nonexistent", client as never);
    expect(result).toBeNull();
  });
});
