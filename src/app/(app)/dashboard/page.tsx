import type { Metadata } from "next";
import Link from "next/link";
import { requireOnboardedUser } from "@/lib/auth/session";
import { VerifyEmailBanner } from "@/components/account/verify-email-banner";
import { listRolePaths } from "@/lib/content/queries";
import { pathUrl } from "@/lib/content/routes";
import { PathSwitcher } from "@/components/content/path-switcher";
import { getDashboardProgress, type ActivePathSummary } from "@/lib/progress/queries";
import { ProgressBar } from "@/components/progress/progress-bar";
import { ResumeCard } from "@/components/progress/resume-card";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Dashboard — AI Learning Platform",
};

// One active path's progress: title, "currently following" / "previously
// followed" label, path-level bar, per-course bars, and a resume entry
// point (task 20). Retained (non-current) paths are visually distinguished
// with a muted border and an explicit label, so FR-PATH-009's retention
// reads as an intentional product behaviour rather than a stray leftover.
function ActivePathCard({ activePath }: { activePath: ActivePathSummary }) {
  return (
    <section
      aria-label={`${activePath.title} — ${activePath.isCurrent ? "current" : "previously followed"} path`}
      className={`rounded-md border p-4 ${
        activePath.isCurrent
          ? "border-[var(--color-primary)] bg-[var(--color-surface)]"
          : "border-[var(--color-border)] bg-[var(--color-surface)] opacity-90"
      }`}
    >
      <p className="text-xs font-medium text-[var(--color-text-muted)]">
        {activePath.isCurrent ? "Currently following" : "Previously followed"}
      </p>
      <h2 className="mt-1 text-lg font-medium text-[var(--color-text)]">
        <Link
          href={pathUrl(activePath.roleArchetype, activePath.level)}
          className="hover:underline"
        >
          {activePath.title}
        </Link>
      </h2>

      <div className="mt-3">
        <ProgressBar label={`${activePath.title} progress`} {...activePath.progress} />
      </div>

      {activePath.courses.length > 0 ? (
        <ul className="mt-3 flex flex-col gap-2">
          {activePath.courses.map((course) => (
            <li key={course.slug}>
              <ProgressBar label={`${course.title} progress`} {...course.progress} />
            </li>
          ))}
        </ul>
      ) : null}

      <div className="mt-4">
        <ResumeCard
          target={activePath.resumeTarget}
          scope="path"
          backHref={pathUrl(activePath.roleArchetype, activePath.level)}
          backLabel={activePath.title}
        />
      </div>
    </section>
  );
}

// FR-ACC-004/005/006/008 (session gating) + FR-PATH-001/009/FR-PROG-003
// (task 31, task 20): the signed-in user's progress view — their current
// path (if any) plus any previously-followed paths they still have
// progress in (decision #7), each with percent-complete bars and a resume
// entry point, and a switcher to change role/level. `NOT_SURE_YET` has no
// path (Risks/open questions #10, PLAN.md) — those users are pointed at
// /paths to browse instead, though any progress they've made by browsing
// directly still shows below the prompt (Risks/open questions #9).
export default async function DashboardPage() {
  const user = await requireOnboardedUser("/dashboard");

  const hasPath =
    Boolean(user.roleArchetype) && user.roleArchetype !== "NOT_SURE_YET" && user.level;
  const [dashboardProgress, roleProfiles] = await Promise.all([
    getDashboardProgress(user),
    listRolePaths(),
  ]);
  const { activePaths } = dashboardProgress;

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

      {!hasPath ? (
        <div className="mt-8 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
          <h2 className="text-lg font-medium text-[var(--color-text)]">Browse learning paths</h2>
          <p className="mt-1 text-sm text-[var(--color-text-muted)]">
            {user.roleArchetype === "NOT_SURE_YET"
              ? "You haven't picked a role yet — browse the paths to find one that fits."
              : "No path is available for your current role and level yet."}{" "}
            Your progress will appear here once you start a path.
          </p>
          <Link
            href="/paths"
            className="mt-2 inline-block text-sm text-[var(--color-primary)] hover:underline"
          >
            Browse paths →
          </Link>
        </div>
      ) : null}

      {activePaths.length > 0 ? (
        <div className="mt-8 flex flex-col gap-4">
          {activePaths.map((activePath) => (
            <ActivePathCard key={activePath.id} activePath={activePath} />
          ))}
        </div>
      ) : null}

      <div className="mt-8 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
        <h3 className="mb-3 text-sm font-medium text-[var(--color-text)]">Switch role or level</h3>
        <PathSwitcher
          roles={roleProfiles.map((profile) => ({ role: profile.role, label: profile.title }))}
          currentRole={user.roleArchetype}
          currentLevel={user.level}
          isSignedIn
        />
      </div>
    </div>
  );
}
