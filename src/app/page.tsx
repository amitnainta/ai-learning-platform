import Link from "next/link";

// Real public landing page (FR-ACC-008: browsable without an account).
export default function HomePage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-16 text-center">
      <h1 className="mb-4 text-3xl font-semibold text-[var(--color-text)]">AI Learning Platform</h1>
      <p className="mb-8 text-lg text-[var(--color-text-muted)]">
        A free, curated AI/ML learning platform: guided learning paths built from curated
        third-party content, with placement, progress tracking, ratings, and certificates.
      </p>
      <div className="flex justify-center gap-4">
        <Link
          href="/sign-up"
          className="rounded-md bg-[var(--color-primary)] px-5 py-2.5 font-medium text-[#0b0f14] hover:bg-[var(--color-primary-hover)]"
        >
          Get started
        </Link>
        <Link
          href="/sign-in"
          className="rounded-md border border-[var(--color-border)] px-5 py-2.5 font-medium text-[var(--color-text)] hover:bg-[var(--color-surface-hover)]"
        >
          Sign in
        </Link>
      </div>
      <p className="mt-8 text-sm text-[var(--color-text-muted)]">
        Browse without an account — you only need to sign up to track progress, rate content, or
        earn a certificate.
      </p>
    </div>
  );
}
