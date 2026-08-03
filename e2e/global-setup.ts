import { PrismaClient } from "@prisma/client";
import { loadContentPack } from "../src/lib/content/loader";
import { importContentPack } from "../src/lib/content/import";

/**
 * Playwright global setup (task 43): imports the content pack into the
 * test database before the suite runs, so local and CI e2e runs are
 * self-seeding — content-*.spec.ts never has to create its own fixture
 * rows. Calls `importContentPack` directly rather than shelling out to
 * `scripts/import-content.ts` (decision #12: the importer is a function
 * first, a CLI wrapper around it second). Idempotent (decision #2), so
 * running this against an already-seeded shared dev database is a no-op —
 * matching the global teardown's user-only scope (it must never delete
 * content rows, or a shared dev database would lose its content on every
 * run — see e2e/global-teardown.ts and the Test plan "Notes" in PLAN.md).
 */
export default async function globalSetup(): Promise<void> {
  const loaded = await loadContentPack();
  if (!loaded.success) {
    throw new Error(
      `Content pack failed to validate before e2e setup:\n${loaded.errors
        .map((error) => `  - ${error}`)
        .join("\n")}`,
    );
  }

  const prisma = new PrismaClient();
  try {
    const summary = await importContentPack({ prisma, pack: loaded.pack });
    console.log("[global-setup] content pack imported:", JSON.stringify(summary));
  } finally {
    await prisma.$disconnect();
  }
}
