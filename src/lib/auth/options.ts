import { APIError, type BetterAuthOptions } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "../prisma";
import { getEnv } from "../env";
import { hashPassword, verifyPassword } from "./password";
import { sendMail } from "../mail/mailer";
import { resetPasswordTemplate, verifyEmailTemplate } from "../mail/templates";
import { AUTH_COOKIE_PREFIX } from "./constants";
import { revokeAllSessions } from "./revoke-sessions";
import { nameSchema } from "../validation/account";

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

    // C3 (REVIEW.md): declared so the Prisma adapter's field-by-field
    // input transform (which only ever forwards fields it knows about)
    // actually writes `userId` to the database — see the
    // `databaseHooks.verification.create.before` hook below, and the
    // `Verification.userId` column comment in prisma/schema.prisma for
    // why this is safe/accurate for every verification row this app
    // creates. `input: false` because it's never client-suppliable —
    // only the hook below derives and sets it.
    verification: {
      additionalFields: {
        userId: {
          type: "string",
          required: false,
          input: false,
        },
      },
    },

    // C2 (REVIEW.md): `minimumAgeAcknowledgedAt` is a Better Auth
    // `user.additionalFields` entry with `input: true`, and `name` is only
    // validated/normalized by `signUpSchema` in the browser — both are
    // trivially bypassed by calling `POST /api/auth/sign-up/email`
    // directly. This hook is the server-side enforcement point for both,
    // reusing the exact validation rules `signUpSchema` already applies
    // client-side (src/lib/validation/account.ts) rather than duplicating
    // them. It fires for every `user` row creation — today that's only the
    // credential sign-up path, since no OAuth provider is configured
    // (PLAN.md decision #3, FR-ACC-009 out of scope) — so a future SSO
    // work item should revisit whether the age-acknowledgment requirement
    // still applies to an OAuth-created user.
    databaseHooks: {
      user: {
        create: {
          before: async (user, _context) => {
            // NFR-SEC-011: require a truthy acknowledgment in the
            // request, then stamp the timestamp ourselves — never trust
            // a client-supplied `minimumAgeAcknowledgedAt` value, which
            // could be omitted, null, or backdated/arbitrary.
            if (!user.minimumAgeAcknowledgedAt) {
              throw new APIError("BAD_REQUEST", {
                code: "MINIMUM_AGE_NOT_ACKNOWLEDGED",
                message: "You must confirm you meet the minimum age requirement to register.",
              });
            }

            // NFR-SEC-007: re-run the same name normalization/length-cap/
            // control-character-stripping `signUpSchema` already applies
            // client-side.
            const nameResult = nameSchema.safeParse(user.name);
            if (!nameResult.success) {
              throw new APIError("BAD_REQUEST", {
                code: "INVALID_NAME",
                message: nameResult.error.issues[0]?.message ?? "Invalid name.",
              });
            }

            return {
              data: {
                name: nameResult.data,
                minimumAgeAcknowledgedAt: new Date(),
              },
            };
          },
        },
      },
      // C3 (REVIEW.md): backfills `Verification.userId` so the real
      // FK-level `onDelete: Cascade` (prisma/schema.prisma) actually
      // fires when the owning User is deleted, instead of leaving these
      // rows orphaned. Only the password-reset flow creates a row here
      // with this app's config — `value` is the target user's id for
      // that flow (see the schema comment for the verified source
      // reference) — so anything else is left with a null `userId`
      // rather than guessed at.
      verification: {
        create: {
          before: async (verification) => {
            if (verification.identifier.startsWith("reset-password:")) {
              return { data: { userId: verification.value } };
            }
          },
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
