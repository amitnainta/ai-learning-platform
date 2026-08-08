import { z } from "zod";

/**
 * Typed, validated access to process.env.
 *
 * This module intentionally does NOT run at import time / app startup for
 * every request — during scaffolding (no product code touches the
 * database yet) that would break `next build`/`next dev` in a fresh
 * checkout before the human has provisioned Neon/Sentry (see
 * docs/runbooks/provisioning-checklist.md). Instead, `getEnv()` validates
 * lazily, the first time a caller that actually needs these values
 * (e.g. the Prisma client singleton) invokes it, and throws a clear,
 * aggregated error immediately if anything required is missing or
 * malformed — i.e. "fail fast" at the point of actual use rather than a
 * cryptic downstream error.
 */

const envSchema = z.object({
  DATABASE_URL: z
    .string()
    .min(1, "DATABASE_URL is required (pooled Neon connection string)")
    .url("DATABASE_URL must be a valid connection URL"),
  DIRECT_URL: z
    .string()
    .min(1, "DIRECT_URL is required (direct Neon connection string, used by Prisma Migrate)")
    .url("DIRECT_URL must be a valid connection URL"),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_URL: z
    .string()
    .min(1, "APP_URL is required")
    .url("APP_URL must be a valid URL")
    .default("http://localhost:3030"),
  BETTER_AUTH_SECRET: z
    .string()
    .min(
      32,
      "BETTER_AUTH_SECRET is required (min 32 chars) — generate with `openssl rand -base64 32` " +
        "and see docs/runbooks/provisioning-checklist.md",
    ),
  BETTER_AUTH_URL: z.string().url("BETTER_AUTH_URL must be a valid URL").optional(),
  RESEND_API_KEY: z.string().optional(),
  // A plain `.email()` check rejects "no-reply@localhost" (no TLD), which
  // is exactly the documented local-dev default (.env.example) — so this
  // uses a deliberately loose "looks like an address" shape check instead.
  EMAIL_FROM: z
    .string()
    .regex(/^[^\s@]+@[^\s@]+$/, "EMAIL_FROM must look like an email address (user@host)")
    .default("no-reply@localhost"),
  MAIL_TRANSPORT: z.enum(["resend", "console", "file"]).optional(),
  // Not a documented product env var (deliberately absent from
  // .env.example): an explicit, narrowly-scoped override so the Playwright
  // e2e suite doesn't trip Better Auth's rate limiter (decision #6; see the
  // "Notes" paragraph under the Test plan in
  // factory/work/user-accounts-auth/PLAN.md). Wired only into
  // playwright.config.ts's webServer env and the CI e2e job's env — never
  // set in production. See src/lib/auth/options.ts for where it's read.
  E2E_DISABLE_RATE_LIMIT: z
    .enum(["true", "false"])
    .optional()
    .transform((value) => value === "true"),
});

export type Env = z.infer<typeof envSchema>;

let cachedEnv: Env | undefined;

/**
 * Validate and return the required server-side environment variables.
 * Throws a descriptive error (listing every missing/invalid var) on first
 * failure so misconfiguration is caught immediately rather than surfacing
 * as an opaque error deep inside a database call.
 */
export function getEnv(): Env {
  if (cachedEnv) {
    return cachedEnv;
  }

  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    throw new Error(
      `Invalid or missing environment variables:\n${issues}\n\n` +
        "Copy .env.example to .env.local and fill in real values. " +
        "See docs/runbooks/provisioning-checklist.md for how to obtain them.",
    );
  }

  // BETTER_AUTH_URL defaults to APP_URL when unset (see .env.example) — this
  // depends on another field's resolved value, so it's applied here rather
  // than as a static zod `.default()`.
  cachedEnv = {
    ...parsed.data,
    BETTER_AUTH_URL: parsed.data.BETTER_AUTH_URL ?? parsed.data.APP_URL,
  };
  return cachedEnv;
}
