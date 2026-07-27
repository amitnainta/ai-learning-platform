import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/session";
import { RoleLevelForm } from "@/components/account/role-level-form";
import { DeleteAccountForm } from "@/components/account/delete-account-form";

export const metadata: Metadata = {
  title: "Account — AI Learning Platform",
};

export default async function AccountPage() {
  const user = await requireUser("/account");

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-12 px-4 py-12">
      <section>
        <h1 className="mb-2 text-2xl font-semibold text-[var(--color-text)]">Your profile</h1>
        <p className="mb-6 text-sm text-[var(--color-text-muted)]">
          Signed in as {user.email}. Change your role or level any time (FR-ACC-006).
        </p>
        <RoleLevelForm
          initialRole={user.roleArchetype}
          initialLevel={user.level}
          submitLabel="Save changes"
          redirectTo="/account"
        />
      </section>

      <section>
        <h2 className="mb-2 text-xl font-semibold text-[var(--color-text)]">Your data</h2>
        <p className="mb-4 text-sm text-[var(--color-text-muted)]">
          Download a copy of the personal data we hold about you.
        </p>
        <a
          href="/api/account/export"
          download
          className="inline-block w-fit rounded-md border border-[var(--color-border)] px-4 py-2 text-sm text-[var(--color-text)] hover:bg-[var(--color-surface-hover)]"
        >
          Download my data
        </a>
      </section>

      <section>
        <h2 className="mb-2 text-xl font-semibold text-[var(--color-danger)]">Danger zone</h2>
        <DeleteAccountForm accountEmail={user.email} />
      </section>
    </div>
  );
}
