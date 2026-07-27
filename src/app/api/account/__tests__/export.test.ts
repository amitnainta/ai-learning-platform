// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

/**
 * FR-ACC-007, NFR-COMP-004: the export payload must contain the requesting
 * user's profile fields and must never contain a password hash or any
 * session/verification token. `requireUser()` and Prisma are both mocked —
 * this test exercises only the route's own shaping of the response.
 */

const MOCK_USER = {
  id: "user_1",
  name: "Ada Lovelace",
  email: "ada@example.com",
  emailVerified: true,
  roleArchetype: "TECHNICAL_BUILDER",
  level: "ADVANCED",
  onboardingCompletedAt: new Date("2026-01-01T00:00:00.000Z"),
  minimumAgeAcknowledgedAt: new Date("2026-01-01T00:00:00.000Z"),
};

const findUniqueOrThrowMock = vi.fn().mockResolvedValue({
  id: MOCK_USER.id,
  name: MOCK_USER.name,
  email: MOCK_USER.email,
  emailVerified: MOCK_USER.emailVerified,
  roleArchetype: MOCK_USER.roleArchetype,
  level: MOCK_USER.level,
  onboardingCompletedAt: MOCK_USER.onboardingCompletedAt,
  minimumAgeAcknowledgedAt: MOCK_USER.minimumAgeAcknowledgedAt,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-02T00:00:00.000Z"),
});

const sessionFindManyMock = vi.fn().mockResolvedValue([
  {
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    expiresAt: new Date("2026-01-15T00:00:00.000Z"),
    ipAddress: "203.0.113.1",
    userAgent: "test-agent",
  },
]);

vi.mock("@/lib/auth/session", () => ({
  requireUser: vi.fn().mockResolvedValue(MOCK_USER),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findUniqueOrThrow: (...args: unknown[]) => findUniqueOrThrowMock(...args) },
    session: { findMany: (...args: unknown[]) => sessionFindManyMock(...args) },
  },
}));

describe("GET /api/account/export", () => {
  it("sets a Content-Disposition attachment header with a dated filename", async () => {
    const { GET } = await import("../export/route");
    const response = await GET();

    const disposition = response.headers.get("Content-Disposition");
    expect(disposition).toMatch(/^attachment; filename="account-export-\d{4}-\d{2}-\d{2}\.json"$/);
  });

  it("returns JSON containing the requesting user's profile fields", async () => {
    const { GET } = await import("../export/route");
    const response = await GET();
    const body = await response.json();

    expect(body.profile).toMatchObject({
      email: MOCK_USER.email,
      name: MOCK_USER.name,
      roleArchetype: MOCK_USER.roleArchetype,
      level: MOCK_USER.level,
    });
    expect(body.sessions).toHaveLength(1);
  });

  it("never includes a password field anywhere in the payload", async () => {
    const { GET } = await import("../export/route");
    const response = await GET();
    const bodyText = await response.text();

    expect(bodyText.toLowerCase()).not.toContain('"password"');
  });

  it("never includes a session token, access token, or verification value", async () => {
    const { GET } = await import("../export/route");
    const response = await GET();
    const bodyText = await response.text();

    for (const forbiddenKey of ["token", "accessToken", "refreshToken", "idToken", '"value"']) {
      expect(bodyText).not.toContain(forbiddenKey);
    }
  });

  it("only selects non-secret session metadata from Prisma (no token column)", async () => {
    const { GET } = await import("../export/route");
    await GET();

    expect(sessionFindManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.not.objectContaining({ token: true }),
      }),
    );
  });
});
