import type { Metadata } from "next";
import Link from "next/link";
import { listRolePaths } from "@/lib/content/queries";
import { roleUrl } from "@/lib/content/routes";

// FR-SEARCH-004 / FR-ACC-008: public index of the role archetypes, no
// session required. Dynamic rendering (decision #11) — this route reads
// Prisma, and CI's build-and-test job builds against a placeholder
// DATABASE_URL with no database behind it, so it must never be prerendered.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Learning paths — AI Learning Platform",
  description: "Guided AI/ML learning paths for every role, from zero knowledge to advanced.",
};

export default async function PathsIndexPage() {
  const roleProfiles = await listRolePaths();

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="mb-2 text-2xl font-semibold text-[var(--color-text)]">Learning paths</h1>
      <p className="mb-8 text-[var(--color-text-muted)]">
        Every path is organized around who you are and how much you already know. Pick the role that
        fits you best — you can change it any time.
      </p>

      <ul className="grid gap-4 sm:grid-cols-2">
        {roleProfiles.map((profile) => (
          <li
            key={profile.id}
            className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-4"
          >
            <h2 className="text-lg font-medium text-[var(--color-text)]">
              <Link href={roleUrl(profile.role)} className="hover:underline">
                {profile.title}
              </Link>
            </h2>
            <p className="mt-1 text-sm text-[var(--color-text-muted)]">{profile.summary}</p>
          </li>
        ))}
      </ul>

      <p className="mt-8 text-sm text-[var(--color-text-muted)]">
        Engineering Leader and Investor paths are coming in a later release — the schema and routes
        already support every role; only the content is still being written.
      </p>
    </div>
  );
}
