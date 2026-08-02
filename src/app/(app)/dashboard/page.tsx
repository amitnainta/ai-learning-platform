import type { Metadata } from "next";
import Link from "next/link";
import { requireOnboardedUser } from "@/lib/auth/session";
import { VerifyEmailBanner } from "@/components/account/verify-email-banner";
import { getPathForRoleLevel, listRolePaths } from "@/lib/content/queries";
import { pathUrl } from "@/lib/content/routes";
import { PathSwitcher } from "@/components/content/path-switcher";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Dashboard — AI Learning Platform",
};

// FR-ACC-004/005/006/008 (session gating) + FR-PATH-001/009 (task 31): the
// signed-in user's current path, with a switcher to change role/level.
// `NOT_SURE_YET` has no path (Risks/open questions #10, PLAN.md) — those
// users are pointed at /paths to browse instead.
export default async function DashboardPage() {
  const user = await requireOnboardedUser("/dashboard");

  const hasPath =
    Boolean(user.roleArchetype) && user.roleArchetype !== "NOT_SURE_YET" && user.level;
  const [path, roleProfiles] = await Promise.all([
    hasPath && user.roleArchetype && user.level
      ? getPathForRoleLevel(user.roleArchetype, user.level)
      : Promise.resolve(null),
    listRolePaths(),
  ]);

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      {!user.emailVerified ? <VerifyEmailBanner email={user.email} /> : null}
      <h1 className="mb-2 text-2xl font-semibold text-[var(--color-text)]">Welcome, {user.name}</h1>
      <dl className="mt-6 grid grid-cols-[max-content_1fr] gap-x-4 gap-y-2 text-sm">
        <dt className="text-[var(--color-text-muted)]">Role</dt>
        <dd className="text-[var(--color-text)]">{user.roleArchetype}</dd>
        <dt className="text-[var(--color-text-muted)]">Level</dt>
        <dd className="text-[var(--color-text)]">{user.level}</dd>
      </dl>

      <div className="mt-8 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
        {path ? (
          <>
            <h2 className="text-lg font-medium text-[var(--color-text)]">
              <Link href={pathUrl(user.roleArchetype!, user.level!)} className="hover:underline">
                {path.title}
              </Link>
            </h2>
            <p className="mt-1 text-sm text-[var(--color-text-muted)]">{path.summary}</p>
          </>
        ) : (
          <>
            <h2 className="text-lg font-medium text-[var(--color-text)]">Browse learning paths</h2>
            <p className="mt-1 text-sm text-[var(--color-text-muted)]">
              {user.roleArchetype === "NOT_SURE_YET"
                ? "You haven't picked a role yet — browse the paths to find one that fits."
                : "No path is available for your current role and level yet."}
            </p>
            <Link
              href="/paths"
              className="mt-2 inline-block text-sm text-[var(--color-primary)] hover:underline"
            >
              Browse paths →
            </Link>
          </>
        )}

        <div className="mt-4 border-t border-[var(--color-border)] pt-4">
          <h3 className="mb-3 text-sm font-medium text-[var(--color-text)]">
            Switch role or level
          </h3>
          <PathSwitcher
            roles={roleProfiles.map((profile) => ({ role: profile.role, label: profile.title }))}
            currentRole={user.roleArchetype}
            currentLevel={user.level}
            isSignedIn
          />
        </div>
      </div>
    </div>
  );
}
