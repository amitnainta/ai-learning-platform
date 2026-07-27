import type { Metadata } from "next";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";

export const metadata: Metadata = {
  title: "Forgot password — AI Learning Platform",
};

export default function ForgotPasswordPage() {
  return (
    <div className="mx-auto max-w-sm px-4 py-12">
      <h1 className="mb-6 text-2xl font-semibold text-[var(--color-text)]">Reset your password</h1>
      <ForgotPasswordForm />
    </div>
  );
}
