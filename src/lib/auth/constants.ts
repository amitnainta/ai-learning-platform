/**
 * Shared cookie-naming constant. Deliberately has zero dependencies (no
 * Prisma, no Better Auth instance) so it's safe to import from
 * src/middleware.ts, which runs on the Edge runtime and cannot import
 * anything that touches the database.
 *
 * Must stay in sync with `advanced.cookiePrefix` in src/lib/auth/options.ts
 * — Better Auth names the session cookie `${cookiePrefix}.session_token`.
 */
export const AUTH_COOKIE_PREFIX = "ai-learning-platform";
export const SESSION_COOKIE_NAME = `${AUTH_COOKIE_PREFIX}.session_token`;
