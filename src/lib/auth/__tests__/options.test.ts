import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Asserts on the plain `BetterAuthOptions` object returned by
 * `buildAuthOptions()` (src/lib/auth/options.ts) — decisions #3-#8, #10 in
 * factory/work/user-accounts-auth/PLAN.md. The Prisma module is mocked so
 * this test never needs a live database (the whole point of exporting a
 * plain options object rather than only the constructed `betterAuth(...)`
 * instance).
 */

vi.mock("../prisma", () => ({ prisma: {} }));

const TEST_ENV = {
  DATABASE_URL: "postgresql://user:pass@localhost:5432/test_db",
  DIRECT_URL: "postgresql://user:pass@localhost:5432/test_db",
  APP_URL: "http://localhost:3000",
  BETTER_AUTH_SECRET: "a".repeat(32),
  NODE_ENV: "test",
} as const;

beforeEach(() => {
  vi.resetModules();
  for (const [key, value] of Object.entries(TEST_ENV)) {
    vi.stubEnv(key, value);
  }
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("buildAuthOptions", () => {
  it("uses the Prisma adapter for database-backed session storage", async () => {
    const { buildAuthOptions } = await import("../options");
    const options = buildAuthOptions();
    expect(options.database).toBeTruthy();
    expect(typeof options.database).toBe("function");
  });

  it("sets a 14-day expiresIn and 1-day updateAge for rolling inactivity expiry", async () => {
    const { buildAuthOptions } = await import("../options");
    const options = buildAuthOptions();
    expect(options.session?.expiresIn).toBe(60 * 60 * 24 * 14);
    expect(options.session?.updateAge).toBe(60 * 60 * 24);
  });

  it("wires the custom argon2 password hasher instead of the scrypt default", async () => {
    const { buildAuthOptions } = await import("../options");
    const options = buildAuthOptions();
    expect(options.emailAndPassword?.password?.hash).toBeTypeOf("function");
    expect(options.emailAndPassword?.password?.verify).toBeTypeOf("function");
  });

  it("does not require email verification before sign-in (decision #8)", async () => {
    const { buildAuthOptions } = await import("../options");
    const options = buildAuthOptions();
    expect(options.emailAndPassword?.requireEmailVerification).toBe(false);
  });

  it("sends a verification email on sign-up", async () => {
    const { buildAuthOptions } = await import("../options");
    const options = buildAuthOptions();
    expect(options.emailVerification?.sendOnSignUp).toBe(true);
    expect(options.emailVerification?.sendVerificationEmail).toBeTypeOf("function");
  });

  it("revokes sessions on password reset", async () => {
    const { buildAuthOptions } = await import("../options");
    const options = buildAuthOptions();
    expect(options.emailAndPassword?.revokeSessionsOnPasswordReset).toBe(true);
    expect(options.emailAndPassword?.onPasswordReset).toBeTypeOf("function");
  });

  it("uses database-backed rate limiting with rules for every sensitive auth path", async () => {
    const { buildAuthOptions } = await import("../options");
    const options = buildAuthOptions();
    expect(options.rateLimit?.storage).toBe("database");
    expect(options.rateLimit?.customRules).toMatchObject({
      "/sign-in/email": { window: 15 * 60, max: 5 },
      "/sign-up/email": { window: 60 * 60, max: 10 },
      "/request-password-reset": { window: 60 * 60, max: 3 },
      "/reset-password": { window: 60 * 60, max: 5 },
    });
  });

  it("enables rate limiting by default (production behaviour)", async () => {
    const { buildAuthOptions } = await import("../options");
    const options = buildAuthOptions();
    expect(options.rateLimit?.enabled).toBe(true);
  });

  it("disables rate limiting only when the explicit e2e override env var is set", async () => {
    vi.stubEnv("E2E_DISABLE_RATE_LIMIT", "true");
    const { buildAuthOptions } = await import("../options");
    const options = buildAuthOptions();
    expect(options.rateLimit?.enabled).toBe(false);
  });

  it("sets SameSite=Lax cookies via a project-specific cookie prefix", async () => {
    const { buildAuthOptions } = await import("../options");
    const options = buildAuthOptions();
    expect(options.advanced?.cookiePrefix).toBe("ai-learning-platform");
    expect(options.advanced?.defaultCookieAttributes?.sameSite).toBe("lax");
  });

  it("derives secure-in-production cookies from an https baseURL (no useSecureCookies override)", async () => {
    // Better Auth sets the `secure` cookie attribute from
    // `advanced.useSecureCookies` when explicitly set, else from the
    // baseURL's protocol (https -> secure, http -> not), else NODE_ENV. We
    // deliberately don't set `useSecureCookies` — `baseURL` is
    // `BETTER_AUTH_URL`/`APP_URL`, which is https in every deployed
    // environment, so cookies come out `secure` there for free and
    // `insecure` (http://localhost) in local dev, without an
    // environment-specific branch in options.ts to maintain.
    vi.stubEnv("APP_URL", "https://example.com");
    vi.stubEnv("BETTER_AUTH_URL", "https://example.com");
    const { buildAuthOptions } = await import("../options");
    const options = buildAuthOptions();
    expect(options.baseURL).toBe("https://example.com");
    expect(
      (options.advanced as { useSecureCookies?: boolean } | undefined)?.useSecureCookies,
    ).toBeUndefined();
  });

  it("resolves the client IP from x-forwarded-for", async () => {
    const { buildAuthOptions } = await import("../options");
    const options = buildAuthOptions();
    expect(options.advanced?.ipAddress?.ipAddressHeaders).toEqual(["x-forwarded-for"]);
  });

  it("caps password length at 12-128 characters", async () => {
    const { buildAuthOptions } = await import("../options");
    const options = buildAuthOptions();
    expect(options.emailAndPassword?.minPasswordLength).toBe(12);
    expect(options.emailAndPassword?.maxPasswordLength).toBe(128);
  });

  it("declares minimumAgeAcknowledgedAt as an additional user field", async () => {
    const { buildAuthOptions } = await import("../options");
    const options = buildAuthOptions();
    expect(options.user?.additionalFields?.minimumAgeAcknowledgedAt).toBeDefined();
  });
});
