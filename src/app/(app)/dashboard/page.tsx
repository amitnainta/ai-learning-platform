import type { Metadata } from "next";
import { requireOnboardedUser } from "@/lib/auth/session";
import { VerifyEmailBanner } from "@/components/account/verify-email-banner";

export const metadata: Metadata = {
  title: "Dashboard — AI Learning Platform",
};

// Placeholder for the real dashboard work item — proves the authenticated,
// onboarded path (FR-ACC-004/005/006/008) and the unverified-email banner
// (decision #8).
export default async function DashboardPage() {
  const user = await requireOnboardedUser("/dashboard");

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
      <p className="mt-8 text-sm text-[var(--color-text-muted)]">
        This is a placeholder dashboard. Learning paths, progress tracking, and course content ship
        with later work items.
      </p>
    </div>
  );
}
