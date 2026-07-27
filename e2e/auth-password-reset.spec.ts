import { expect, test } from "@playwright/test";
import { uniqueTestEmail } from "./helpers/db";
import { extractActionLink, readLatestMailFor } from "./helpers/mail";
import { registerAndOnboard } from "./helpers/register";

const OLD_PASSWORD = "correct-horse-battery-staple";
const NEW_PASSWORD = "brand-new-battery-staple";

// FR-ACC-003, NFR-SEC-003.
test.describe("password reset", () => {
  test("reset via emailed link: old password fails, new password works, prior session dies", async ({
    browser,
  }) => {
    const email = uniqueTestEmail("reset");

    // A separate context holds a session established *before* the reset,
    // so we can prove it's invalidated afterwards without it being
    // affected by the reset flow's own navigation.
    const sessionContext = await browser.newContext();
    const sessionPage = await sessionContext.newPage();
    await registerAndOnboard(sessionPage.request, {
      email,
      password: OLD_PASSWORD,
      name: "Reset User",
    });

    const resetContext = await browser.newContext();
    const resetPage = await resetContext.newPage();

    await resetPage.goto("/forgot-password");
    await resetPage.getByLabel("Email").fill(email);
    await resetPage.getByRole("button", { name: /send reset link/i }).click();
    await expect(resetPage.getByRole("status")).toContainText(/if an account exists/i);

    const message = await readLatestMailFor(email);
    const actionLink = extractActionLink(message);
    await resetPage.goto(actionLink);
    await expect(resetPage).toHaveURL(/\/reset-password\?token=/);

    await resetPage.getByLabel("New password").fill(NEW_PASSWORD);
    await resetPage.getByRole("button", { name: /reset password/i }).click();
    await expect(resetPage).toHaveURL(/\/sign-in$/);

    // The old password no longer works.
    await resetPage.getByLabel("Email").fill(email);
    await resetPage.getByLabel("Password").fill(OLD_PASSWORD);
    await resetPage.getByRole("button", { name: /^sign in$/i }).click();
    await expect(resetPage.getByText("Incorrect email or password.")).toBeVisible();

    // The new password works.
    await resetPage.getByLabel("Password").fill(NEW_PASSWORD);
    await resetPage.getByRole("button", { name: /^sign in$/i }).click();
    await expect(resetPage).toHaveURL(/\/dashboard$/);

    // The pre-existing session from before the reset is dead.
    await sessionPage.goto("/dashboard");
    await expect(sessionPage).toHaveURL(/\/sign-in/);

    await sessionContext.close();
    await resetContext.close();
  });

  test("requesting a reset for an unknown address shows the identical confirmation", async ({
    page,
  }) => {
    await page.goto("/forgot-password");
    await page.getByLabel("Email").fill(uniqueTestEmail("does-not-exist"));
    await page.getByRole("button", { name: /send reset link/i }).click();

    await expect(page.getByRole("status")).toContainText(/if an account exists/i);
  });
});
