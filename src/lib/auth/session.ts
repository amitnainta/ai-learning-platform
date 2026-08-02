import { headers as nextHeaders } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "./index";
import { prisma } from "../prisma";
import type { ProficiencyLevel, RoleArchetype } from "@prisma/client";

/**
 * Authoritative, server-side access-control checks (FR-ACC-008). The
 * middleware (src/middleware.ts) is a UX fast path only — it cannot run
 * Prisma at the edge, so every protected read/write must also call one of
 * these before touching data.
 */

export interface CurrentUser {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  roleArchetype: RoleArchetype | null;
  level: ProficiencyLevel | null;
  onboardingCompletedAt: Date | null;
  minimumAgeAcknowledgedAt: Date | null;
}

/**
 * Returns the signed-in user's session-derived identity plus the product
 * profile fields Better Auth doesn't manage (role/level/onboarding), or
 * `null` when there is no valid session.
 */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const session = await auth.api.getSession({ headers: await nextHeaders() });
  if (!session) {
    return null;
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      name: true,
      email: true,
      emailVerified: true,
      roleArchetype: true,
      level: true,
      onboardingCompletedAt: true,
      minimumAgeAcknowledgedAt: true,
    },
  });

  return user;
}

/**
 * Redirects to `/sign-in?next=<current path>` when there is no session.
 * Call from server components/route handlers that require authentication.
 */
export async function requireUser(nextPath?: string): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) {
    const next = nextPath ? `?next=${encodeURIComponent(nextPath)}` : "";
    redirect(`/sign-in${next}`);
  }
  return user;
}

/**
 * Like `requireUser`, but additionally redirects to `/onboarding` when the
 * user hasn't completed role/level selection yet (FR-ACC-004/005).
 */
export async function requireOnboardedUser(nextPath?: string): Promise<CurrentUser> {
  const user = await requireUser(nextPath);
  if (!user.roleArchetype || !user.level) {
    redirect("/onboarding");
  }
  return user;
}
