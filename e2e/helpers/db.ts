import { PrismaClient } from "@prisma/client";

/**
 * e2e-only Prisma access (task 42 in factory/work/user-accounts-auth/PLAN.md).
 *
 * Every user the e2e suite creates gets an email under `TEST_EMAIL_DOMAIN`,
 * so cleanup can safely `deleteMany` by domain — this is what makes the
 * suite safe to re-run against a shared dev database (see the Test plan
 * "Notes" in PLAN.md): it can never touch a real user row, only ones it
 * created itself.
 */

export const TEST_EMAIL_DOMAIN = "e2e.test";

let counter = 0;

const prisma = new PrismaClient();

/**
 * A unique, valid-looking email for a single test-created account.
 * Includes a timestamp + counter + random suffix so parallel workers and
 * repeated local runs never collide.
 */
export function uniqueTestEmail(label = "user"): string {
  counter += 1;
  const random = Math.random().toString(36).slice(2, 8);
  return `${label}-${Date.now()}-${counter}-${random}@${TEST_EMAIL_DOMAIN}`.toLowerCase();
}

/**
 * Deletes every `User` row created by the e2e suite. Cascades to
 * `Session`/`Account`/`Verification` via the schema's `onDelete: Cascade`.
 * Called from the Playwright global teardown (playwright.config.ts).
 */
export async function cleanupTestUsers(): Promise<void> {
  await prisma.user.deleteMany({
    where: { email: { endsWith: `@${TEST_EMAIL_DOMAIN}` } },
  });
}

/** Look up a test user directly, for assertions the UI doesn't expose
 * (e.g. `minimumAgeAcknowledgedAt`). */
export async function findTestUserByEmail(email: string) {
  return prisma.user.findUnique({ where: { email } });
}

export async function countActiveSessionsForEmail(email: string): Promise<number> {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return 0;
  }
  return prisma.session.count({ where: { userId: user.id } });
}

/**
 * Counts `Verification` rows backfilled with the given `userId` (REVIEW.md
 * C3 — `databaseHooks.verification.create.before` in
 * src/lib/auth/options.ts stamps this from the password-reset flow's
 * `value` field). `userId` must be captured *before* deleting the account,
 * since the row it refers to won't exist afterwards.
 */
export async function countVerificationRowsForUserId(userId: string): Promise<number> {
  return prisma.verification.count({ where: { userId } });
}

/**
 * A test user's progress rows joined to their content-item slugs, for
 * assertions the UI does not expose directly (e.g. `completedAt` being
 * non-null, or that exactly one row exists) — task 31,
 * factory/work/progress-tracking/PLAN.md. `cleanupTestUsers()` above needs
 * no change for `Progress`: `Progress.userId` is `onDelete: Cascade`
 * (prisma/schema.prisma), so deleting the test `User` row already removes
 * every progress row it owns. The teardown must still never touch content
 * rows (`ContentItem`/`Course`/`Path` etc. are shared, seeded fixtures —
 * see e2e/global-teardown.ts and global-setup.ts), and this helper doesn't
 * either: it only reads.
 */
export async function findProgressForEmail(email: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return [];
  }
  return prisma.progress.findMany({
    where: { userId: user.id },
    include: { contentItem: { select: { slug: true, title: true } } },
  });
}

export async function disconnectTestDb(): Promise<void> {
  await prisma.$disconnect();
}
