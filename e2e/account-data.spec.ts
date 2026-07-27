import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { uniqueTestEmail } from "./helpers/db";
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
});
