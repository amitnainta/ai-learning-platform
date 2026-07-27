"use client";

import { createAuthClient } from "better-auth/react";
import { inferAdditionalFields } from "better-auth/client/plugins";
import type { auth } from "./index";

/**
 * Better Auth client for use from client components (decision #10 in
 * factory/work/user-accounts-auth/PLAN.md): sign-up, sign-in, sign-out,
 * password reset request/confirm, and the `useSession` hook. Account
 * mutations (profile, export, delete) go through our own
 * `/api/account/*` route handlers instead — see src/lib/auth/index.ts and
 * src/app/api/account/*.
 *
 * `inferAdditionalFields<typeof auth>()` is a type-only import of the
 * server `auth` instance (elided at build time — it never pulls Prisma or
 * server config into the client bundle) so `signUp.email(...)` knows about
 * `minimumAgeAcknowledgedAt` (NFR-SEC-011) without a hand-maintained type.
 */
export const authClient = createAuthClient({
  baseURL: typeof window !== "undefined" ? window.location.origin : undefined,
  plugins: [inferAdditionalFields<typeof auth>()],
});

export const { signUp, signIn, signOut, useSession, requestPasswordReset, resetPassword } =
  authClient;
