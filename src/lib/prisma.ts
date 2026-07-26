import { PrismaClient } from "@prisma/client";

/**
 * Hot-reload/serverless-safe Prisma client singleton.
 *
 * - In dev, Next.js hot-reloads modules, which would otherwise create a
 *   fresh PrismaClient (and a fresh DB connection pool) on every reload
 *   and quickly exhaust Postgres connections. We stash the instance on
 *   `globalThis` so it survives module reloads.
 * - In serverless production (Vercel functions), each cold-start gets its
 *   own module scope, so this still behaves correctly: one client per
 *   isolated instance, none of them holding cross-request in-memory state
 *   (supports NFR-SCALE-001 statelessness — all durable state lives in
 *   Postgres, not in this process).
 */

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma: PrismaClient = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
