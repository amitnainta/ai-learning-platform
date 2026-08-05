import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { countVerificationRowsForUserId, findTestUserByEmail, uniqueTestEmail } from "./helpers/db";
import { readLatestMailFor } from "./helpers/mail";
import { registerAndOnboard } from "./helpers/register";

const PASSWORD = "correct-horse-battery-staple";

// FR-ACC-007, NFR-COMP-004: export and hard delete.
test.describe("account data export and deletion", () => {
  test("downloads a personal-data export with no password field, then deletes the account", async ({
    page,
  }) => {
    const email = uniqueTestEmail("data");
    await registerAndOnboard(page.request, {
      email,
      password: PASSWORD,
      name: "Data Rights User",
    });

    // Decision #9 (progress-tracking): complete one item first, so the
    // export's `progress` array has something real to assert on.
    const completeResponse = await page.request.post("/api/progress", {
      data: { contentItemSlug: "what-is-artificial-intelligence", action: "complete" },
    });
    expect(completeResponse.ok()).toBe(true);

    await page.goto("/account");

    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("link", { name: /download my data/i }).click(),
    ]);

    const downloadPath = await download.path();
    expect(downloadPath).not.toBeNull();
    const contents = readFileSync(downloadPath as string, "utf-8");
    const exportPayload = JSON.parse(contents);

    expect(exportPayload.profile.email).toBe(email);
    expect(contents.toLowerCase()).not.toContain('"password"');
    expect(contents).not.toContain("token");

    // Decision #9: the export includes a progress entry for the completed
    // item, addressed by slug (never the underlying cuid).
    expect(exportPayload.progress).toContainEqual(
      expect.objectContaining({
        slug: "what-is-artificial-intelligence",
        status: "COMPLETE",
      }),
    );

    // Danger zone: typed confirmation must match exactly before the
    // button enables.
    const deleteButton = page.getByRole("button", {
      name: /permanently delete my account/i,
    });
    await expect(deleteButton).toBeDisabled();
    await page.getByLabel(new RegExp(`Type ${email}`, "i")).fill(email);
    await expect(deleteButton).toBeEnabled();
    await deleteButton.click();

    await expect(page).toHaveURL(/\/account-deleted$/);

    // The account and its credentials are gone.
    await page.goto("/sign-in");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(PASSWORD);
    await page.getByRole("button", { name: /sign in/i }).click();
    await expect(page.getByText("Incorrect email or password.")).toBeVisible();

    // A deletion confirmation email landed in the outbox.
    const message = await readLatestMailFor(email);
    expect(message.subject).toMatch(/account has been deleted/i);
  });

  // REVIEW.md C3: Verification rows (e.g. a password-reset token) must be
  // gone once the account is deleted, not left orphaned.
  test("deleting the account also removes its Verification rows", async ({ page }) => {
    const email = uniqueTestEmail("verify-cascade");
    await registerAndOnboard(page.request, {
      email,
      password: PASSWORD,
      name: "Cascade User",
    });

    // Create a real Verification row for this user (identifier
    // `reset-password:<token>`, backfilled `userId`) via the actual
    // forgot-password flow, the same one auth-password-reset.spec.ts uses.
    await page.goto("/forgot-password");
    await page.getByLabel("Email").fill(email);
    await page.getByRole("button", { name: /send reset link/i }).click();
    await expect(page.getByRole("status")).toContainText(/if an account exists/i);

    const userBeforeDeletion = await findTestUserByEmail(email);
    expect(userBeforeDeletion).not.toBeNull();
    const userId = userBeforeDeletion!.id;

    await expect
      .poll(() => countVerificationRowsForUserId(userId), {
        message: "expected the password-reset request to create a backfilled Verification row",
      })
      .toBeGreaterThan(0);

    await page.goto("/account");
    const deleteButton = page.getByRole("button", {
      name: /permanently delete my account/i,
    });
    await page.getByLabel(new RegExp(`Type ${email}`, "i")).fill(email);
    await expect(deleteButton).toBeEnabled();
    await deleteButton.click();
    await expect(page).toHaveURL(/\/account-deleted$/);

    expect(await countVerificationRowsForUserId(userId)).toBe(0);
  });
});
