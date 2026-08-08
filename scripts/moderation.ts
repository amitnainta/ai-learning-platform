import { prisma } from "../src/lib/prisma";
import { listUnresolvedFlagsGroupedByRating } from "../src/lib/ratings/queries";
import { dismissRatingFlags, hideRating, unhideRating } from "../src/lib/ratings/mutations";

/**
 * The minimum actionable moderation loop (task 23, decision #5,
 * factory/work/ratings-and-feedback/PLAN.md) — a `tsx` script, following
 * `scripts/import-content.ts`'s structure exactly: a deliberately not-an-API-route
 * operator tool, because an authenticated moderation endpoint would be a
 * mini admin UI that NFR-SEC-006's RBAC does not yet exist to protect.
 *
 * `npm run moderation:queue` runs `list` (the default). The other verbs are
 * invoked directly with `npx tsx scripts/moderation.ts <verb> <ratingId>`.
 */

function printUsage(): void {
  console.error("Usage:");
  console.error("  npx tsx scripts/moderation.ts list");
  console.error('  npx tsx scripts/moderation.ts hide <ratingId> --reason "..."');
  console.error("  npx tsx scripts/moderation.ts unhide <ratingId>");
  console.error("  npx tsx scripts/moderation.ts dismiss <ratingId>");
}

function truncate(text: string, maxLength = 200): string {
  return text.length > maxLength ? `${text.slice(0, maxLength)}…` : text;
}

async function runList(): Promise<void> {
  const groups = await listUnresolvedFlagsGroupedByRating();

  if (groups.length === 0) {
    console.log("No unresolved flags.");
    return;
  }

  console.log(`${groups.length} rating(s) with unresolved flags:\n`);
  for (const group of groups) {
    console.log(
      `Rating ${group.ratingId} — ${group.targetType} "${group.targetTitle}" (${group.targetSlug})`,
    );
    console.log(`  stars: ${group.stars}  hidden: ${group.hiddenAt ? "yes" : "no"}`);
    console.log(
      `  createdAt: ${group.createdAt.toISOString()}  updatedAt: ${group.updatedAt.toISOString()}`,
    );
    console.log(`  flags: ${group.flagCount}  reasons: ${group.reasons.join(", ")}`);
    if (group.notes.length > 0) {
      for (const note of group.notes) {
        console.log(`    note: ${truncate(note)}`);
      }
    }
    if (group.feedback) {
      console.log(`  feedback: ${truncate(group.feedback)}`);
    }
    console.log("");
  }
}

function parseReasonFlag(argv: string[]): string | null {
  const flagIndex = argv.indexOf("--reason");
  if (flagIndex === -1 || argv[flagIndex + 1] === undefined) {
    return null;
  }
  return argv[flagIndex + 1]!;
}

async function runHide(ratingId: string | undefined, argv: string[]): Promise<void> {
  if (!ratingId) {
    console.error("Missing <ratingId>.");
    printUsage();
    process.exitCode = 1;
    return;
  }
  const reason = parseReasonFlag(argv);
  if (!reason) {
    console.error('Missing --reason "...".');
    printUsage();
    process.exitCode = 1;
    return;
  }

  try {
    await hideRating({ ratingId, reason });
    console.log(`Hid rating ${ratingId} and resolved its unresolved flags.`);
  } catch {
    console.error(`No rating found with id "${ratingId}".`);
    process.exitCode = 1;
  }
}

async function runUnhide(ratingId: string | undefined): Promise<void> {
  if (!ratingId) {
    console.error("Missing <ratingId>.");
    printUsage();
    process.exitCode = 1;
    return;
  }

  try {
    await unhideRating(ratingId);
    console.log(`Unhid rating ${ratingId}.`);
  } catch {
    console.error(`No rating found with id "${ratingId}".`);
    process.exitCode = 1;
  }
}

async function runDismiss(ratingId: string | undefined): Promise<void> {
  if (!ratingId) {
    console.error("Missing <ratingId>.");
    printUsage();
    process.exitCode = 1;
    return;
  }

  const result = await dismissRatingFlags(ratingId);
  if (result.count === 0) {
    console.error(`No unresolved flags found for rating "${ratingId}".`);
    process.exitCode = 1;
    return;
  }
  console.log(`Resolved ${result.count} flag(s) for rating ${ratingId} without hiding it.`);
}

async function main(): Promise<void> {
  const [verb, ...rest] = process.argv.slice(2);

  switch (verb ?? "list") {
    case "list":
      await runList();
      break;
    case "hide":
      await runHide(rest[0], rest);
      break;
    case "unhide":
      await runUnhide(rest[0]);
      break;
    case "dismiss":
      await runDismiss(rest[0]);
      break;
    default:
      console.error(`Unknown command "${verb}".`);
      printUsage();
      process.exitCode = 1;
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
