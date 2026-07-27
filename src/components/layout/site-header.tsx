import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/session";
import { SignOutButton } from "@/components/auth/sign-out-button";

/**
 * Server component: reads the session server-side and renders the
 * signed-out vs. signed-in nav (visible evidence for FR-ACC-008 and
 * FR-ACC-002 — anyone can see at a glance whether they're recognized).
 */
export async function SiteHeader() {
  const user = await getCurrentUser();

  return (
    <header className="border-b border-[var(--color-border)] bg-[var(--color-surface)]">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <Link href="/" className="font-semibold text-[var(--color-text)]">
          AI Learning Platform
        </Link>
        <nav className="flex items-center gap-4 text-sm">
          {user ? (
            <>
              <Link href="/dashboard" className="text-[var(--color-text)]">
                Dashboard
              </Link>
              <Link href="/account" className="text-[var(--color-text)]">
                Account
              </Link>
              <SignOutButton />
            </>
          ) : (
            <>
              <Link href="/sign-in" className="text-[var(--color-text)]">
                Sign in
              </Link>
              <Link
                href="/sign-up"
                className="rounded-md bg-[var(--color-primary)] px-3 py-1.5 text-[#0b0f14] hover:bg-[var(--color-primary-hover)]"
              >
                Sign up
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
