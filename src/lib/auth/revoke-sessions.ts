import { prisma } from "../prisma";

/**
 * Delete every session row for a user (NFR-SEC-003: a password change or
 * reset must invalidate every existing session). Split into its own module
 * (rather than living in index.ts) so it can be imported from
 * src/lib/auth/options.ts without a circular dependency (index.ts builds
 * the `betterAuth(...)` instance from options.ts).
 */
export async function revokeAllSessions(userId: string): Promise<void> {
  await prisma.session.deleteMany({ where: { userId } });
}
