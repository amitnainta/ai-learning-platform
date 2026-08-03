import { defineConfig, devices } from "@playwright/test";
import { config as loadEnv } from "dotenv";

// Loads .env.local (DATABASE_URL/DIRECT_URL etc.) into this config process
// and — since `webServer.env` below spreads `process.env` — into the
// booted Next.js server too. Never overrides an already-set variable, so
// CI's job-level env (postgres:16 service container, see
// .github/workflows/ci.yml) always wins over any local file.
loadEnv({ path: ".env.local" });

const PORT = process.env.PORT ?? 3000;
const baseURL = process.env.APP_URL ?? `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [["html", { open: "never" }]],
  // Imports the content pack (task 43, learning-paths-content) so the
  // content-*.spec.ts journeys are self-seeding in both CI and local runs;
  // idempotent, so a shared dev database that's already seeded is a no-op.
  globalSetup: "./e2e/global-setup.ts",
  // Cleans up every e2e-created user (e2e/helpers/db.ts) after the run so
  // the suite stays safe to re-run against a shared dev database (Test
  // plan notes, PLAN.md). Deliberately user-scoped only — it must never
  // delete content rows, or a shared dev database would lose its seeded
  // content on every run.
  globalTeardown: "./e2e/global-teardown.ts",
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  // Boots the production build so the suite exercises the real app (not
  // just dev-mode HMR). CI builds first, then this reuses that build;
  // locally, `npm run test:e2e` triggers the build itself.
  webServer: {
    command: "npm run build && npm run start",
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      ...process.env,
      // Forced last, overriding any ambient "test" (set by the Playwright
      // runner itself, or by CI's job-level env — see
      // .github/workflows/ci.yml) — this command runs a real production
      // build + server (per the comment above), and Next.js skips loading
      // .env.local entirely when NODE_ENV=test, which starves the build of
      // DATABASE_URL/DIRECT_URL/BETTER_AUTH_SECRET and breaks it outright.
      NODE_ENV: "production",
      // File transport (src/lib/mail/mailer.ts) so specs can read a real
      // reset/verify link from .mail-outbox/ without a mail provider.
      MAIL_TRANSPORT: "file",
      // Test-plan note (PLAN.md): rate limiting must be relaxed for e2e or
      // the login/registration specs trip the real limiter. Scoped to this
      // webServer's env only — never set for a deployed environment. See
      // src/lib/auth/options.ts for where this is read.
      E2E_DISABLE_RATE_LIMIT: "true",
    },
  },
});
