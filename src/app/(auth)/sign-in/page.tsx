import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { SignInForm } from "@/components/auth/sign-in-form";
import { getCurrentUser } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "Sign in — AI Learning Platform",
};

// Redirects an already-signed-in visitor to the dashboard. Deliberately done
// here (via the authoritative getCurrentUser() check) rather than in
// middleware.ts, which can only see whether a session *cookie* is present —
// see the comment in middleware.ts for why a presence-only check here would
// produce an infinite redirect loop for a stale/revoked-but-still-present
// cookie.
export default async function SignInPage() {
  const user = await getCurrentUser();
  if (user) {
    redirect("/dashboard");
  }

  return (
    <div className="mx-auto max-w-sm px-4 py-12">
      <h1 className="mb-6 text-2xl font-semibold text-[var(--color-text)]">Sign in</h1>
      <Suspense>
        <SignInForm />
      </Suspense>
      <p className="mt-4 text-sm">
        <Link href="/forgot-password" className="text-[var(--color-primary)]">
          Forgot your password?
        </Link>
      </p>
      <p className="mt-2 text-sm text-[var(--color-text-muted)]">
        Don&apos;t have an account?{" "}
        <Link href="/sign-up" className="text-[var(--color-primary)]">
          Sign up
        </Link>
      </p>
    </div>
  );
}
