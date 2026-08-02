import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getRoleProfile, listPathsForRole } from "@/lib/content/queries";
import { parseRoleSegment, pathUrl } from "@/lib/content/routes";
import { PROFICIENCY_LEVEL_LABELS } from "@/lib/content/taxonomy";
import { Markdown } from "@/components/content/markdown";

export const dynamic = "force-dynamic";

interface RolePageParams {
  role: string;
}

async function loadRole(role: string) {
  const roleArchetype = parseRoleSegment(role);
  if (!roleArchetype) {
    return null;
  }
  const profile = await getRoleProfile(roleArchetype);
  if (!profile) {
    return null;
  }
  const paths = await listPathsForRole(roleArchetype);
  return { profile, paths };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<RolePageParams>;
}): Promise<Metadata> {
  const { role } = await params;
  const data = await loadRole(role);
  if (!data) {
    return { title: "Path not found — AI Learning Platform" };
  }
  return {
    title: `${data.profile.title} — AI Learning Platform`,
    description: data.profile.summary,
  };
}

// FR-SEARCH-004: one landing page per role archetype, public, describing
// who the role is for and listing its three levels.
export default async function RolePage({ params }: { params: Promise<RolePageParams> }) {
  const { role } = await params;
  const data = await loadRole(role);
  if (!data) {
    notFound();
  }

  const { profile, paths } = data;

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="mb-2 text-2xl font-semibold text-[var(--color-text)]">{profile.title}</h1>
      <p className="mb-6 text-[var(--color-text-muted)]">{profile.summary}</p>

      <Markdown content={profile.body} />

      <h2 className="mt-10 mb-4 text-xl font-semibold text-[var(--color-text)]">Levels</h2>
      <ul className="grid gap-4 sm:grid-cols-3">
        {paths.map((path) => {
          const courseCount = path.courses.length;
          const totalMinutes = path.courses.reduce(
            (sum, pathCourse) =>
              sum +
              pathCourse.course.items.reduce(
                (itemSum, item) => itemSum + item.contentItem.estimatedMinutes,
                0,
              ),
            0,
          );
          return (
            <li
              key={path.id}
              className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-4"
            >
              <h3 className="text-base font-medium text-[var(--color-text)]">
                <Link href={pathUrl(profile.role, path.level)} className="hover:underline">
                  {PROFICIENCY_LEVEL_LABELS[path.level]}
                </Link>
              </h3>
              <p className="mt-1 text-sm text-[var(--color-text-muted)]">{path.summary}</p>
              <p className="mt-2 text-xs text-[var(--color-text-muted)]">
                {courseCount} course{courseCount === 1 ? "" : "s"} · {totalMinutes} min total
              </p>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
