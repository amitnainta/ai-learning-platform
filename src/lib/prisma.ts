import { PrismaClient } from "@prisma/client";
import { getEnv } from "./env";

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
 * - `getEnv()` is called before constructing the client so a missing/invalid
 *   `DATABASE_URL`/`DIRECT_URL` fails fast with a clear, aggregated error the
 *   first time anything actually imports this module — rather than surfacing
 *   later as an opaque Prisma connection error.
 */

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient(): PrismaClient {
  getEnv();
  return new PrismaClient();
}

export const prisma: PrismaClient = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
