"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { authClient } from "@/lib/auth/client";

export function SignOutButton() {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);

  async function handleSignOut() {
    setIsPending(true);
    await authClient.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={handleSignOut}
      disabled={isPending}
      className="rounded-md border border-[var(--color-border)] px-3 py-1.5 text-sm text-[var(--color-text)] hover:bg-[var(--color-surface-hover)] disabled:opacity-50"
    >
      {isPending ? "Signing out…" : "Sign out"}
    </button>
  );
}
