import { expect, test } from "@playwright/test";
import { uniqueTestEmail } from "./helpers/db";
import { registerAndOnboard } from "./helpers/register";

const PASSWORD = "correct-horse-battery-staple";

// FR-ACC-002, FR-ACC-008, NFR-SEC-003.
test.describe("login, logout, and route protection", () => {
  test("signs in to the dashboard and signs out, clearing the session", async ({ page }) => {
    const email = uniqueTestEmail("login");
    await registerAndOnboard(page.request, { email, password: PASSWORD, name: "Login User" });
    // registerAndOnboard signs the user in via the API to complete
    // onboarding; clear that session so this test exercises the actual
    // sign-in UI from a logged-out state.
    await page.context().clearCookies();

    await page.goto("/sign-in");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(PASSWORD);
    await page.getByRole("button", { name: /sign in/i }).click();

    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByRole("heading", { name: /welcome, login user/i })).toBeVisible();

    await page.getByRole("button", { name: /sign out/i }).click();
    await expect(page).toHaveURL("/");

    const cookies = await page.context().cookies();
    expect(cookies.some((cookie) => cookie.name.includes("session_token"))).toBe(false);

    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/sign-in/);
  });

  test("a wrong password shows a generic error that doesn't reveal account existence", async ({
    page,
  }) => {
    const email = uniqueTestEmail("wrong-pw");
    await registerAndOnboard(page.request, { email, password: PASSWORD, name: "Wrong Password" });
    await page.context().clearCookies();

    await page.goto("/sign-in");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill("totally-incorrect-password");
    await page.getByRole("button", { name: /sign in/i }).click();

    await expect(page.getByText("Incorrect email or password.")).toBeVisible();
    await expect(page).toHaveURL(/\/sign-in$/);
  });

  test("anonymous access to protected routes redirects to sign-in", async ({ page }) => {
    for (const path of ["/dashboard", "/onboarding", "/account"]) {
      await page.goto(path);
      await expect(page).toHaveURL(/\/sign-in/);
    }
  });
});
