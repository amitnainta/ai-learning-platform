import Link from "next/link";
import type { ResumeTarget } from "@/lib/progress/percent";
import { courseUrl, lessonUrl } from "@/lib/content/routes";

/**
 * FR-PROG-002 (task 15). Renders one of `findResumeTarget`'s four states.
 * Used at both path scope (dashboard, path page) and course scope (course
 * page) — decision #6: the same resume-target function, and this same
 * component, serve both because a course is just a one-course "path" for
 * this purpose.
 *
 * Link target follows decision #6: `/lessons/<slug>` for an `ORIGINAL`
 * item; for a `CURATED` item (no detail page) `/courses/<courseSlug>#item-
 * <itemSlug>`, landing the learner on the card that holds the outbound
 * link and the completion control rather than throwing them straight out
 * to a third-party site.
 */
export function ResumeCard({
  target,
  scope,
  backHref,
  backLabel,
}: {
  target: ResumeTarget;
  scope: "path" | "course";
  /** Where the "you're done" state links back to. */
  backHref: string;
  backLabel: string;
}) {
  if (target.kind === "empty") {
    return null;
  }

  if (target.kind === "complete") {
    return (
      <div className="rounded-md border border-[var(--color-success)] bg-[var(--color-surface)] p-4">
        <p className="text-sm font-medium text-[var(--color-text)]">
          {scope === "path" ? "Path complete" : "Course complete"}
        </p>
        <p className="mt-1 text-sm text-[var(--color-text-muted)]">
          You&apos;ve completed every item.{" "}
          <Link href={backHref} className="text-[var(--color-primary)] hover:underline">
            Back to {backLabel}
          </Link>
        </p>
      </div>
    );
  }

  const itemHref =
    target.item.sourceType === "ORIGINAL"
      ? lessonUrl(target.item.slug)
      : `${courseUrl(target.course.slug)}#item-${target.item.slug}`;

  const isStart = target.kind === "start";

  return (
    <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
      <p className="text-sm font-medium text-[var(--color-text)]">
        {isStart ? `Start the ${scope}` : "Resume where you left off"}
      </p>
      <p className="mt-1 text-sm text-[var(--color-text-muted)]">in {target.course.title}</p>
      <Link
        href={itemHref}
        className="mt-2 inline-block text-sm text-[var(--color-primary)] hover:underline"
      >
        {isStart ? "Start" : "Resume"}: {target.item.title}
      </Link>
    </div>
  );
}
