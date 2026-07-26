import { defineConfig, devices } from "@playwright/test";

const PORT = process.env.PORT ?? 3000;
const baseURL = process.env.APP_URL ?? `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [["html", { open: "never" }]],
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
  // Boots the production build so the smoke test exercises the real
  // app (not just dev-mode HMR). CI builds first, then this reuses that
  // build; locally, `npm run test:e2e` triggers the build itself.
  webServer: {
    command: "npm run build && npm run start",
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
