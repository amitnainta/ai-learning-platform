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
    .default("http://localhost:3000"),
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

  cachedEnv = parsed.data;
  return cachedEnv;
}
