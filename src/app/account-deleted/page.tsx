import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Account deleted — AI Learning Platform",
};

// Public page (no session required — the account and its cookie are
// already gone by the time the user lands here). Referenced by
// DeleteAccountForm's post-delete redirect (decision #2).
export default function AccountDeletedPage() {
  return (
    <div className="mx-auto max-w-sm px-4 py-12 text-center">
      <h1 className="mb-4 text-2xl font-semibold text-[var(--color-text)]">
        Your account has been deleted
      </h1>
      <p className="mb-6 text-sm text-[var(--color-text-muted)]">
        All your personal data has been permanently removed. We&apos;ve sent a confirmation email to
        the address on file.
      </p>
      <Link href="/" className="text-[var(--color-primary)] underline">
        Back to the homepage
      </Link>
    </div>
  );
}
