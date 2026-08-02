import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getGlossaryTermsBySlugs, getLessonBySlug } from "@/lib/content/queries";
import { findGlossaryLinks } from "@/lib/content/loader";
import { lessonUrl } from "@/lib/content/routes";
import { Markdown } from "@/components/content/markdown";
import { TagList } from "@/components/content/tag-list";
import { SampleContentBadge } from "@/components/content/sample-content-badge";
import { LessonVideo } from "@/components/content/lesson-video";

export const dynamic = "force-dynamic";

interface LessonPageParams {
  slug: string;
}

function formatReviewDate(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(date);
}

export async function generateMetadata({
  params,
}: {
  params: Promise<LessonPageParams>;
}): Promise<Metadata> {
  const { slug } = await params;
  const lesson = await getLessonBySlug(slug);
  if (!lesson) {
    return { title: "Lesson not found — AI Learning Platform" };
  }
  return { title: `${lesson.title} — AI Learning Platform`, description: lesson.summary };
}

// FR-PATH-005/007/008: an original lesson — tags, last-reviewed date, the
// sample-content banner, the optional video, the rendered body with
// contextual glossary links, and previous/next links within its course.
// `notFound()` for a curated or retired slug (decision #10 — curated items
// have no detail page).
export default async function LessonPage({ params }: { params: Promise<LessonPageParams> }) {
  const { slug } = await params;
  const lesson = await getLessonBySlug(slug);
  if (!lesson || !lesson.body) {
    notFound();
  }

  const glossarySlugs = findGlossaryLinks(lesson.body);
  const glossaryTerms = await getGlossaryTermsBySlugs(glossarySlugs);

  // Previous/next within the first course this lesson belongs to. Curated
  // neighbours are skipped — they have no detail page (decision #10).
  const firstCourse = lesson.courses[0]?.course;
  let previous: { slug: string; title: string } | null = null;
  let next: { slug: string; title: string } | null = null;
  if (firstCourse) {
    const index = firstCourse.items.findIndex((item) => item.contentItem.slug === slug);
    const before = firstCourse.items.slice(0, index).reverse();
    const after = firstCourse.items.slice(index + 1);
    const previousItem = before.find((item) => item.contentItem.sourceType === "ORIGINAL");
    const nextItem = after.find((item) => item.contentItem.sourceType === "ORIGINAL");
    previous = previousItem
      ? { slug: previousItem.contentItem.slug, title: previousItem.contentItem.title }
      : null;
    next = nextItem ? { slug: nextItem.contentItem.slug, title: nextItem.contentItem.title } : null;
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="mb-2 text-2xl font-semibold text-[var(--color-text)]">{lesson.title}</h1>
      <p className="mb-4 text-[var(--color-text-muted)]">{lesson.summary}</p>

      <div className="mb-4">
        <TagList item={lesson} />
      </div>

      <p className="mb-6 text-xs text-[var(--color-text-muted)]">
        Last reviewed {formatReviewDate(lesson.lastReviewedAt)}
      </p>

      <SampleContentBadge sourceType={lesson.sourceType} variant="banner" />

      <LessonVideo
        item={{
          title: lesson.title,
          videoUrl: lesson.videoUrl,
          videoCaptionsUrl: lesson.videoCaptionsUrl,
          videoPosterUrl: lesson.videoPosterUrl,
        }}
      />

      <Markdown content={lesson.body} glossaryTerms={glossaryTerms} />

      {previous || next ? (
        <nav className="mt-10 flex items-center justify-between border-t border-[var(--color-border)] pt-4 text-sm">
          {previous ? (
            <Link
              href={lessonUrl(previous.slug)}
              className="text-[var(--color-primary)] hover:underline"
            >
              ← {previous.title}
            </Link>
          ) : (
            <span />
          )}
          {next ? (
            <Link
              href={lessonUrl(next.slug)}
              className="text-[var(--color-primary)] hover:underline"
            >
              {next.title} →
            </Link>
          ) : (
            <span />
          )}
        </nav>
      ) : null}
    </div>
  );
}
