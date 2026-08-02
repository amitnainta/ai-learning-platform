import type { Metadata } from "next";
import { Suspense } from "react";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";

export const metadata: Metadata = {
  title: "Reset password — AI Learning Platform",
};

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  return (
    <div className="mx-auto max-w-sm px-4 py-12">
      <h1 className="mb-6 text-2xl font-semibold text-[var(--color-text)]">
        Choose a new password
      </h1>
      <Suspense>
        <ResetPasswordForm token={token ?? null} />
      </Suspense>
    </div>
  );
}
