import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { SignUpForm } from "@/components/auth/sign-up-form";
import { getCurrentUser } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "Sign up — AI Learning Platform",
};

// See src/app/(auth)/sign-in/page.tsx for why this authoritative check
// lives here rather than as a presence-only redirect in middleware.ts.
export default async function SignUpPage() {
  const user = await getCurrentUser();
  if (user) {
    redirect("/dashboard");
  }

  return (
    <div className="mx-auto max-w-sm px-4 py-12">
      <h1 className="mb-6 text-2xl font-semibold text-[var(--color-text)]">Create your account</h1>
      <SignUpForm />
      <p className="mt-6 text-sm text-[var(--color-text-muted)]">
        Already have an account?{" "}
        <Link href="/sign-in" className="text-[var(--color-primary)]">
          Sign in
        </Link>
      </p>
    </div>
  );
}
