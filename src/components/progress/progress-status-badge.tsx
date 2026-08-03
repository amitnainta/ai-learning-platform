import type { DisplayProgressStatus } from "@/lib/progress/status";
import { PROGRESS_STATUS_LABELS } from "@/lib/progress/status";

/**
 * A small status chip (task 11). The label text is the signal — distinct
 * token-based styling per state is a secondary cue, never the only one
 * (NFR-A11Y-002: no reliance on colour alone). Renders nothing for
 * `NOT_STARTED` on an anonymous view (no `progress` prop supplied at all —
 * see `<ContentItemCard>`), so this component itself has no anonymous-mode
 * branch to get wrong.
 */

const STATUS_STYLES: Record<DisplayProgressStatus, string> = {
  NOT_STARTED:
    "border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-muted)]",
  IN_PROGRESS:
    "border-[var(--color-primary)] bg-[var(--color-surface)] text-[var(--color-primary)]",
  COMPLETE: "border-[var(--color-success)] bg-[var(--color-surface)] text-[var(--color-success)]",
};

export function ProgressStatusBadge({ status }: { status: DisplayProgressStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${STATUS_STYLES[status]}`}
    >
      {PROGRESS_STATUS_LABELS[status]}
    </span>
  );
}
