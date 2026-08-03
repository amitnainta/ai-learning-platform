import type { ProgressStatus } from "@prisma/client";

/**
 * The three-state display vocabulary FR-PROG-001 asks for (task 4). Only
 * two of the three states are ever persisted (`ProgressStatus` — decision
 * #2, factory/work/progress-tracking/PLAN.md); "not started" is the
 * absence of a `Progress` row, mapped here at read time. This is the
 * single source of truth for every label and badge in the app — no other
 * module should hand-write one of these three strings.
 */

export type DisplayProgressStatus = "NOT_STARTED" | "IN_PROGRESS" | "COMPLETE";

export const PROGRESS_STATUS_LABELS: Record<DisplayProgressStatus, string> = {
  NOT_STARTED: "Not started",
  IN_PROGRESS: "In progress",
  COMPLETE: "Complete",
};

/**
 * Maps a persisted row's status (or `undefined`, meaning no row exists) to
 * the display vocabulary. Absence-as-not-started (decision #2) is
 * implemented in exactly this one place.
 */
export function displayStatusFor(
  row: { status: ProgressStatus } | undefined | null,
): DisplayProgressStatus {
  if (!row) {
    return "NOT_STARTED";
  }
  return row.status;
}
