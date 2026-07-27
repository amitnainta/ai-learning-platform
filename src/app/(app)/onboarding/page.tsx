import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/session";
import { RoleLevelForm } from "@/components/account/role-level-form";

export const metadata: Metadata = {
  title: "Get started — AI Learning Platform",
};

// FR-ACC-004/005, FR-PLACE-001/002: presents the four role archetypes plus
// "not sure yet" and the three levels immediately after registration.
export default async function OnboardingPage() {
  const user = await requireUser("/onboarding");

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="mb-2 text-2xl font-semibold text-[var(--color-text)]">
        Tell us a bit about you
      </h1>
      <p className="mb-8 text-sm text-[var(--color-text-muted)]">
        This helps us point you at the right starting material. You can change this any time from
        your account page.
      </p>
      <RoleLevelForm
        initialRole={user.roleArchetype}
        initialLevel={user.level}
        submitLabel="Continue to dashboard"
        redirectTo="/dashboard"
      />
    </div>
  );
}
