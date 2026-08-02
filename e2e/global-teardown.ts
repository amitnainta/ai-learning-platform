import { cleanupTestUsers, disconnectTestDb } from "./helpers/db";

/**
 * Playwright global teardown (task 49 in
 * factory/work/user-accounts-auth/PLAN.md): removes every user the e2e
 * suite created (matched by `TEST_EMAIL_DOMAIN` in e2e/helpers/db.ts), so
 * the suite is safe to re-run against a shared dev database.
 */
export default async function globalTeardown(): Promise<void> {
  await cleanupTestUsers();
  await disconnectTestDb();
}
