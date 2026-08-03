import Link from "next/link";
import type { SourceType } from "@prisma/client";
import { lessonUrl } from "@/lib/content/routes";
import { TagList, type TaggedContentItem } from "@/components/content/tag-list";
import { SampleContentBadge } from "@/components/content/sample-content-badge";
import { ExternalLink } from "@/components/content/external-link";
import { ProgressStatusBadge } from "@/components/progress/progress-status-badge";
import { ProgressControl } from "@/components/progress/progress-control";
import { CuratedOpenTracker } from "@/components/progress/curated-open-tracker";
import type { DisplayProgressStatus } from "@/lib/progress/status";

/**
 * One item in a course or path listing (task 20). Original items link
 * internally to `/lessons/<slug>`; curated items render `<ExternalLink>`
 * to the external URL with publisher/author attribution and any
 * `attributionNote` (decision #10 — curated items have no detail page).
 *
 * `progress`/`showControl` are optional (task 16, progress-tracking work
 * item) — every existing call site that omits them renders exactly as
 * before. When `progress` is supplied, a `<ProgressStatusBadge>` renders
 * next to the sample-content badge for every item; the completion control
 * itself only appears for a `CURATED` item with `showControl` set
 * (decision #1: an original item's control lives at the end of its lesson
 * page instead, per content decision #10's "curated items have no detail
 * page").
 */

export interface ContentItemCardData extends TaggedContentItem {
  slug: string;
  title: string;
  summary: string;
  sourceType: SourceType;
  lastReviewedAt: Date;
  externalUrl: string | null;
  sourcePublisher: string | null;
  sourceAuthor: string | null;
  attributionNote: string | null;
}

// `timeZone: "UTC"` is deliberate: `lastReviewedAt` is a date (the day an
// item was last reviewed), stored as a UTC midnight timestamp. Formatting
// it in the server/browser's local timezone would shift the displayed day
// for any visitor west of UTC (e.g. a US-based visitor would see "May 31"
// for a value stored as "2026-06-01T00:00:00Z"). Rendering in UTC keeps the
// displayed date stable regardless of where the app runs or who's viewing.
function formatReviewDate(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  }).format(date);
}

export function ContentItemCard({
  item,
  position,
  progress,
  showControl,
}: {
  item: ContentItemCardData;
  position?: number;
  progress?: { status: DisplayProgressStatus };
  showControl?: boolean;
}) {
  const isOriginal = item.sourceType === "ORIGINAL";
  const resourceLinkBody = (
    <>
      <ExternalLink href={item.externalUrl ?? ""}>Open this resource</ExternalLink>
      <span className="ml-2 text-[var(--color-text-muted)]">
        {item.sourcePublisher}
        {item.sourceAuthor ? ` — ${item.sourceAuthor}` : ""}
      </span>
    </>
  );

  return (
    <li
      id={`item-${item.slug}`}
      className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-4"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          {position !== undefined ? (
            <p className="text-xs text-[var(--color-text-muted)]">Item {position}</p>
          ) : null}
          <h3 className="text-base font-medium text-[var(--color-text)]">
            {isOriginal ? (
              <Link href={lessonUrl(item.slug)} className="hover:underline">
                {item.title}
              </Link>
            ) : (
              item.title
            )}
          </h3>
        </div>
        <div className="flex items-center gap-2">
          {progress ? <ProgressStatusBadge status={progress.status} /> : null}
          {isOriginal ? <SampleContentBadge sourceType={item.sourceType} variant="inline" /> : null}
        </div>
      </div>

      <p className="mt-1 text-sm text-[var(--color-text-muted)]">{item.summary}</p>

      {!isOriginal && item.externalUrl ? (
        <p className="mt-2 text-sm">
          {showControl ? (
            <CuratedOpenTracker contentItemSlug={item.slug}>{resourceLinkBody}</CuratedOpenTracker>
          ) : (
            resourceLinkBody
          )}
        </p>
      ) : null}

      {!isOriginal && item.attributionNote ? (
        <p className="mt-1 text-xs text-[var(--color-text-muted)]">{item.attributionNote}</p>
      ) : null}

      <div className="mt-3">
        <TagList item={item} />
      </div>

      <p className="mt-2 text-xs text-[var(--color-text-muted)]">
        Last reviewed {formatReviewDate(item.lastReviewedAt)}
      </p>

      {!isOriginal && showControl && progress ? (
        <div className="mt-3">
          <ProgressControl
            contentItemSlug={item.slug}
            contentItemTitle={item.title}
            initialStatus={progress.status}
          />
        </div>
      ) : null}
    </li>
  );
}
