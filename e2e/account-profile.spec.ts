import { expect, test } from "@playwright/test";
import { uniqueTestEmail } from "./helpers/db";
import { registerAndOnboard } from "./helpers/register";

const PASSWORD = "correct-horse-battery-staple";

// FR-ACC-006: role and level can be changed at any time and the change
// persists across sign-out and sign-in.
test.describe("account profile", () => {
  test("changing role and level from /account persists across re-login", async ({ page }) => {
    const email = uniqueTestEmail("profile");
    await registerAndOnboard(page.request, {
      email,
      password: PASSWORD,
      name: "Profile User",
    });

    await page.goto("/account");
    await page.getByRole("radio", { name: /Engineering leader/i }).check();
    await page.getByRole("radio", { name: /Advanced/i }).check();
    await page.getByRole("button", { name: /save changes/i }).click();

    await expect(page).toHaveURL(/\/account$/);
    await expect(page.getByRole("radio", { name: /Engineering leader/i })).toBeChecked();
    await expect(page.getByRole("radio", { name: /Advanced/i })).toBeChecked();

    await page.getByRole("button", { name: /sign out/i }).click();
    await expect(page).toHaveURL("/");

    await page.goto("/sign-in");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(PASSWORD);
    await page.getByRole("button", { name: /sign in/i }).click();

    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByText("ENGINEERING_LEADER")).toBeVisible();
    await expect(page.getByText("ADVANCED")).toBeVisible();

    await page.goto("/account");
    await expect(page.getByRole("radio", { name: /Engineering leader/i })).toBeChecked();
    await expect(page.getByRole("radio", { name: /Advanced/i })).toBeChecked();
  });
});
