/**
 * FR-PROG-003 percentage bar (task 10). A real `role="progressbar"` with
 * `aria-valuemin`/`aria-valuemax`/`aria-valuenow` and an `aria-valuetext`
 * that agrees with the visible text (NFR-A11Y-002/-004) — a screen-reader
 * user gets "3 of 8 items complete (38%)" whether or not they can see the
 * fill. Server component: no interactivity, just a computed render.
 */

export interface ProgressBarProps {
  /** Accessible name for the bar (e.g. "AI Foundations for Builders progress"). */
  label: string;
  completedCount: number;
  totalCount: number;
  percent: number;
}

export function ProgressBar({ label, completedCount, totalCount, percent }: ProgressBarProps) {
  if (totalCount === 0) {
    return (
      <div className="text-xs text-[var(--color-text-muted)]">
        <span className="font-medium text-[var(--color-text)]">{label}</span> — No items yet
      </div>
    );
  }

  const valueText = `${completedCount} of ${totalCount} items complete (${percent}%)`;

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline justify-between text-xs">
        <span className="font-medium text-[var(--color-text)]">{label}</span>
        <span className="text-[var(--color-text-muted)]">{valueText}</span>
      </div>
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        aria-valuetext={valueText}
        aria-label={label}
        className="h-2 w-full overflow-hidden rounded-full bg-[var(--color-border)]"
      >
        <div
          className="h-full rounded-full bg-[var(--color-primary)] transition-[width]"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
