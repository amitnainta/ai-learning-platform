import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { getPathForRoleLevel, listRolePaths } from "@/lib/content/queries";
import { parseLevelSegment, parseRoleSegment } from "@/lib/content/routes";
import { Markdown } from "@/components/content/markdown";
import { CourseSummary } from "@/components/content/course-summary";
import { ContentItemCard } from "@/components/content/content-item-card";
import { PathSwitcher } from "@/components/content/path-switcher";

export const dynamic = "force-dynamic";

interface PathPageParams {
  role: string;
  level: string;
}

async function loadPath(role: string, level: string) {
  const roleArchetype = parseRoleSegment(role);
  const proficiencyLevel = parseLevelSegment(level);
  if (!roleArchetype || !proficiencyLevel) {
    return null;
  }
  const path = await getPathForRoleLevel(roleArchetype, proficiencyLevel);
  if (!path) {
    return null;
  }
  return { roleArchetype, proficiencyLevel, path };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<PathPageParams>;
}): Promise<Metadata> {
  const { role, level } = await params;
  const data = await loadPath(role, level);
  if (!data) {
    return { title: "Path not found — AI Learning Platform" };
  }
  return { title: `${data.path.title} — AI Learning Platform`, description: data.path.summary };
}

// FR-PATH-001/002: the ordered path — description, total duration, then
// each course in order with its items in order.
export default async function PathPage({ params }: { params: Promise<PathPageParams> }) {
  const { role, level } = await params;
  const data = await loadPath(role, level);
  if (!data) {
    notFound();
  }

  const { roleArchetype, path } = data;
  const [user, roleProfiles] = await Promise.all([getCurrentUser(), listRolePaths()]);

  const totalMinutes = path.courses.reduce(
    (sum, pathCourse) =>
      sum +
      pathCourse.course.items.reduce(
        (itemSum, item) => itemSum + item.contentItem.estimatedMinutes,
        0,
      ),
    0,
  );
  const totalItems = path.courses.reduce(
    (sum, pathCourse) => sum + pathCourse.course.items.length,
    0,
  );

  const isCurrentPath = user?.roleArchetype === roleArchetype && user?.level === path.level;

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="mb-2 text-2xl font-semibold text-[var(--color-text)]">{path.title}</h1>
      <p className="mb-4 text-[var(--color-text-muted)]">{path.summary}</p>
      {isCurrentPath ? (
        <p
          role="status"
          className="mb-4 inline-block rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1 text-xs text-[var(--color-text-muted)]"
        >
          This is your current path
        </p>
      ) : null}

      <div className="mb-6">
        <Markdown content={path.description} />
      </div>

      <p className="mb-6 text-sm text-[var(--color-text-muted)]">
        {path.courses.length} course{path.courses.length === 1 ? "" : "s"} · {totalItems} item
        {totalItems === 1 ? "" : "s"} · {totalMinutes} min total
      </p>

      <div className="mb-8 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
        <h2 className="mb-3 text-sm font-medium text-[var(--color-text)]">Switch role or level</h2>
        <PathSwitcher
          roles={roleProfiles.map((profile) => ({ role: profile.role, label: profile.title }))}
          currentRole={user?.roleArchetype ?? roleArchetype}
          currentLevel={user?.level ?? path.level}
          isSignedIn={Boolean(user)}
        />
      </div>

      <div className="flex flex-col gap-8">
        {path.courses.map((pathCourse) => (
          <section key={pathCourse.id}>
            <CourseSummary
              course={{
                slug: pathCourse.course.slug,
                title: pathCourse.course.title,
                summary: pathCourse.course.summary,
                items: pathCourse.course.items.map((item) => ({
                  estimatedMinutes: item.contentItem.estimatedMinutes,
                })),
              }}
            />
            <ol className="mt-4 flex flex-col gap-3">
              {pathCourse.course.items.map((item, index) => (
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
          </section>
        ))}
      </div>
    </div>
  );
}
