import { PrismaClient } from "@prisma/client";
import { loadContentPack } from "../src/lib/content/loader";
import { importContentPack } from "../src/lib/content/import";

/**
 * CLI wrapper (task 12): `npm run content:import` / `npm run content:check`
 * (`--dry-run`). Parses `--dry-run` and an optional pack path, calls the
 * loader, prints validation errors to stderr and exits `1` when the pack is
 * invalid, otherwise calls `importContentPack` and prints the
 * created/updated/unchanged/retired summary. Disconnects Prisma cleanly.
 *
 * Runs as a `tsx` script, not a Prisma `seed` hook or an API route
 * (decision #12) — an operational tool a human runs deliberately, dry-run
 * first. Playwright's global setup (e2e/global-setup.ts) calls
 * `importContentPack` directly rather than shelling out to this script, so
 * local/CI e2e runs are self-seeding without a child process.
 */

function parseArgs(argv: string[]): { dryRun: boolean; packDir?: string } {
  const dryRun = argv.includes("--dry-run");
  const packArg = argv.find((arg) => !arg.startsWith("--"));
  return { dryRun, packDir: packArg };
}

function printSummaryLine(
  label: string,
  counts: {
    created: number;
    updated: number;
    unchanged: number;
    retired: number;
    unretired: number;
  },
): void {
  console.log(
    `  ${label.padEnd(13)} created=${counts.created} updated=${counts.updated} unchanged=${counts.unchanged} retired=${counts.retired} unretired=${counts.unretired}`,
  );
}

async function main(): Promise<void> {
  const { dryRun, packDir } = parseArgs(process.argv.slice(2));

  const loaded = await loadContentPack(packDir);
  if (!loaded.success) {
    console.error(`Content pack validation failed (${loaded.errors.length} error(s)):\n`);
    for (const error of loaded.errors) {
      console.error(`  - ${error}`);
    }
    process.exitCode = 1;
    return;
  }

  if (dryRun) {
    console.log("Content pack is valid.");
  }

  const prisma = new PrismaClient();
  try {
    const summary = await importContentPack({ prisma, pack: loaded.pack, dryRun });
    console.log(dryRun ? "\nDry run — planned changes (nothing written):" : "\nImport complete:");
    printSummaryLine("topics", summary.topics);
    printSummaryLine("roleProfiles", summary.roleProfiles);
    printSummaryLine("glossary", summary.glossary);
    printSummaryLine("items", summary.items);
    printSummaryLine("courses", summary.courses);
    printSummaryLine("paths", summary.paths);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
