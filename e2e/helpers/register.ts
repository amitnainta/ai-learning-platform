import type { APIRequestContext } from "@playwright/test";

/**
 * Test-only setup helper shared by the login/logout, password-reset,
 * profile, and data specs (tasks 44-47 in
 * factory/work/user-accounts-auth/PLAN.md): creates and onboards a user
 * directly through the Better Auth / account APIs so each spec doesn't
 * have to re-drive the sign-up + onboarding UI just to get to its actual
 * scenario. The registration UI itself is exercised end-to-end by
 * e2e/auth-registration.spec.ts.
 */

export interface TestAccount {
  email: string;
  password: string;
  name: string;
}

export async function registerAndOnboard(
  request: APIRequestContext,
  account: TestAccount,
  profile: { roleArchetype: string; level: string } = {
    roleArchetype: "TECHNICAL_BUILDER",
    level: "INTERMEDIATE",
  },
): Promise<void> {
  const signUpResponse = await request.post("/api/auth/sign-up/email", {
    data: {
      name: account.name,
      email: account.email,
      password: account.password,
      minimumAgeAcknowledgedAt: new Date().toISOString(),
    },
  });
  if (!signUpResponse.ok()) {
    throw new Error(`Sign-up failed: ${signUpResponse.status()} ${await signUpResponse.text()}`);
  }

  const profileResponse = await request.patch("/api/account/profile", { data: profile });
  if (!profileResponse.ok()) {
    throw new Error(
      `Profile update failed: ${profileResponse.status()} ${await profileResponse.text()}`,
    );
  }
}
