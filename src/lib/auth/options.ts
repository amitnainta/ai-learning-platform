import type { BetterAuthOptions } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "../prisma";
import { getEnv } from "../env";
import { hashPassword, verifyPassword } from "./password";
import { sendMail } from "../mail/mailer";
import { resetPasswordTemplate, verifyEmailTemplate } from "../mail/templates";
import { AUTH_COOKIE_PREFIX } from "./constants";
import { revokeAllSessions } from "./revoke-sessions";

/**
 * Plain Better Auth options object (decision #3, #4, #5, #6, #7, #8, #10 in
 * factory/work/user-accounts-auth/PLAN.md). Exported separately from the
 * `betterAuth(...)` instance (src/lib/auth/index.ts) so it's unit-testable
 * (src/lib/auth/__tests__/options.test.ts) without constructing Prisma.
 */

// Session (decision #4, NFR-SEC-003): rolling inactivity expiry — a session
// unused for 14 days is dead; an active one is silently extended at most
// once a day.
const SESSION_EXPIRES_IN_SECONDS = 60 * 60 * 24 * 14; // 14 days
const SESSION_UPDATE_AGE_SECONDS = 60 * 60 * 24; // 1 day

// Rate limiting (decision #6, NFR-SEC-005): database-backed so counters are
// shared across serverless instances (NFR-SCALE-001), not per-process
// in-memory. Keyed by client IP via `advanced.ipAddress.ipAddressHeaders`.
const RATE_LIMIT_RULES = {
  SIGN_IN: { window: 15 * 60, max: 5 }, // 5 per 15 minutes
  SIGN_UP: { window: 60 * 60, max: 10 }, // 10 per hour
  REQUEST_PASSWORD_RESET: { window: 60 * 60, max: 3 }, // 3 per hour
  RESET_PASSWORD: { window: 60 * 60, max: 5 }, // 5 per hour
} as const;

// Deliberately no `: BetterAuthOptions` return-type annotation — that would
// widen the return value to the general interface and erase the literal
// `user.additionalFields.minimumAgeAcknowledgedAt` shape, which the client
// (src/lib/auth/client.ts, `inferAdditionalFields<typeof auth>()`) needs to
// type `signUp.email({ minimumAgeAcknowledgedAt: ... })`. `satisfies`
// below still type-checks this object against `BetterAuthOptions` without
// losing that literal type.
export function buildAuthOptions() {
  const env = getEnv();

  // Test-plan note (factory/work/user-accounts-auth/PLAN.md): rate limiting
  // must be relaxed for the e2e/CI environment via an explicit env-driven
  // override, or the login specs trip the limiter. This is never set in
  // production — see playwright.config.ts and .github/workflows/ci.yml for
  // the only two places it's set to "true". The limiter itself (rules,
  // database storage) is unconditionally real; only `enabled` changes.
  const rateLimitEnabled = !env.E2E_DISABLE_RATE_LIMIT;

  return {
    appName: "AI Learning Platform",
    baseURL: env.BETTER_AUTH_URL,
    secret: env.BETTER_AUTH_SECRET,
    database: prismaAdapter(prisma, { provider: "postgresql" }),

    emailAndPassword: {
      enabled: true,
      minPasswordLength: 12,
      maxPasswordLength: 128,
      autoSignIn: true,
      // NFR-SEC-003: a password reset must invalidate every existing
      // session for that user. This build doesn't expose an in-app
      // "change password while signed in" flow (out of scope — see PLAN.md
      // scope section), so the reset-via-email path is the only one that
      // needs covering here; `revokeAllSessions()` (src/lib/auth/index.ts)
      // remains available for that future flow.
      requireEmailVerification: false,
      revokeSessionsOnPasswordReset: true,
      password: {
        hash: hashPassword,
        verify: ({ hash, password }) => verifyPassword(hash, password),
      },
      sendResetPassword: async ({ user, url }) => {
        const template = resetPasswordTemplate({
          name: user.name || user.email,
          url,
          expiresInMinutes: 60,
        });
        await sendMail({ to: user.email, ...template });
      },
      // Belt-and-suspenders alongside `revokeSessionsOnPasswordReset`
      // above: explicitly revokes every session for the user whose
      // password was just reset (NFR-SEC-003, task 34 in
      // factory/work/user-accounts-auth/PLAN.md). Idempotent if the
      // built-in option already cleared them.
      onPasswordReset: async ({ user }) => {
        await revokeAllSessions(user.id);
      },
    },

    emailVerification: {
      sendOnSignUp: true,
      sendVerificationEmail: async ({ user, url }) => {
        const template = verifyEmailTemplate({ name: user.name || user.email, url });
        await sendMail({ to: user.email, ...template });
      },
    },

    session: {
      expiresIn: SESSION_EXPIRES_IN_SECONDS,
      updateAge: SESSION_UPDATE_AGE_SECONDS,
    },

    user: {
      additionalFields: {
        minimumAgeAcknowledgedAt: {
          type: "date",
          required: false,
          input: true,
        },
      },
    },

    advanced: {
      cookiePrefix: AUTH_COOKIE_PREFIX,
      defaultCookieAttributes: {
        sameSite: "lax",
      },
      ipAddress: {
        ipAddressHeaders: ["x-forwarded-for"],
      },
    },

    trustedOrigins: [env.APP_URL],

    rateLimit: {
      enabled: rateLimitEnabled,
      storage: "database",
      customRules: {
        "/sign-in/email": RATE_LIMIT_RULES.SIGN_IN,
        "/sign-up/email": RATE_LIMIT_RULES.SIGN_UP,
        "/request-password-reset": RATE_LIMIT_RULES.REQUEST_PASSWORD_RESET,
        "/reset-password": RATE_LIMIT_RULES.RESET_PASSWORD,
      },
    },
  } satisfies BetterAuthOptions;
}
