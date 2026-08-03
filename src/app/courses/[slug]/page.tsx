import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCourseBySlug } from "@/lib/content/queries";
import { pathUrl } from "@/lib/content/routes";
import { Markdown } from "@/components/content/markdown";
import { ContentItemCard } from "@/components/content/content-item-card";

export const dynamic = "force-dynamic";

interface CoursePageParams {
  slug: string;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<CoursePageParams>;
}): Promise<Metadata> {
  const { slug } = await params;
  const course = await getCourseBySlug(slug);
  if (!course) {
    return { title: "Course not found — AI Learning Platform" };
  }
  return { title: `${course.title} — AI Learning Platform`, description: course.summary };
}

// A single course, its ordered items, and links back to every published
// path that contains it — the overlap from decision #5 made visible.
export default async function CoursePage({ params }: { params: Promise<CoursePageParams> }) {
  const { slug } = await params;
  const course = await getCourseBySlug(slug);
  if (!course) {
    notFound();
  }

  const totalMinutes = course.items.reduce(
    (sum, item) => sum + item.contentItem.estimatedMinutes,
    0,
  );

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="mb-2 text-2xl font-semibold text-[var(--color-text)]">{course.title}</h1>
      <p className="mb-4 text-[var(--color-text-muted)]">{course.summary}</p>
      {course.description ? (
        <div className="mb-6">
          <Markdown content={course.description} />
        </div>
      ) : null}

      <p className="mb-6 text-sm text-[var(--color-text-muted)]">
        {course.items.length} item{course.items.length === 1 ? "" : "s"} · {totalMinutes} min total
      </p>

      {course.paths.length > 0 ? (
        <div className="mb-8">
          <h2 className="mb-2 text-sm font-medium text-[var(--color-text)]">Part of these paths</h2>
          <ul className="flex flex-wrap gap-2">
            {course.paths.map((pathCourse) => (
              <li key={pathCourse.id}>
                <Link
                  href={pathUrl(pathCourse.path.roleArchetype, pathCourse.path.level)}
                  className="rounded-full border border-[var(--color-border)] px-3 py-1 text-xs text-[var(--color-text)] hover:bg-[var(--color-surface-hover)]"
                >
                  {pathCourse.path.title}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <ol className="flex flex-col gap-3">
        {course.items.map((item, index) => (
          <ContentItemCard
            key={item.id}
            position={index + 1}
            item={{
              slug: item.contentItem.slug,
              title: item.contentItem.title,
              summary: item.contentItem.summary,
              sourceType: item.contentItem.sourceType,
              roles: item.contentItem.roles,
              level: item.contentItem.level,
              format: item.contentItem.format,
              estimatedMinutes: item.contentItem.estimatedMinutes,
              lastReviewedAt: item.contentItem.lastReviewedAt,
              topics: item.contentItem.topics,
              externalUrl: item.contentItem.externalUrl,
              sourcePublisher: item.contentItem.sourcePublisher,
              sourceAuthor: item.contentItem.sourceAuthor,
              attributionNote: item.contentItem.attributionNote,
            }}
          />
        ))}
      </ol>
    </div>
  );
}
