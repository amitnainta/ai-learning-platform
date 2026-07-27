import { expect, test } from "@playwright/test";
import { findTestUserByEmail, uniqueTestEmail } from "./helpers/db";

const PASSWORD = "correct-horse-battery-staple";

// FR-ACC-001, FR-ACC-004/005, FR-PLACE-001/002, NFR-SEC-011 — registration
// and placement (self-select) journeys, per NFR-MAINT-004.
test.describe("registration and placement", () => {
  test("registers, completes onboarding, and reaches the dashboard", async ({ page }) => {
    const email = uniqueTestEmail("register");

    await page.goto("/sign-up");
    await page.getByLabel("Name").fill("Ada Lovelace");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(PASSWORD);
    await page.getByLabel(/I confirm I am 16 years of age or older/).check();
    await page.getByRole("button", { name: /create account/i }).click();

    await expect(page).toHaveURL(/\/onboarding$/);
    await expect(page.getByRole("heading", { name: /tell us a bit about you/i })).toBeVisible();

    await page.getByRole("radio", { name: /Technical builder/i }).check();
    await page.getByRole("radio", { name: /Zero knowledge/i }).check();
    await page.getByRole("button", { name: /continue to dashboard/i }).click();

    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByRole("heading", { name: /welcome, ada lovelace/i })).toBeVisible();
    await expect(page.getByText("TECHNICAL_BUILDER")).toBeVisible();
    await expect(page.getByText("ZERO_KNOWLEDGE")).toBeVisible();

    // NFR-SEC-011: the acknowledgment must be recorded on the user record,
    // not just accepted client-side.
    const user = await findTestUserByEmail(email);
    expect(user?.minimumAgeAcknowledgedAt).not.toBeNull();
  });

  test("rejects sign-up without the minimum-age acknowledgment", async ({ page }) => {
    const email = uniqueTestEmail("no-ack");

    await page.goto("/sign-up");
    await page.getByLabel("Name").fill("No Ack");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(PASSWORD);
    await page.getByRole("button", { name: /create account/i }).click();

    await expect(page).toHaveURL(/\/sign-up$/);
    await expect(page.getByText(/confirm you meet the minimum age requirement/i)).toBeVisible();

    const user = await findTestUserByEmail(email);
    expect(user).toBeNull();
  });

  test("a display name containing a script tag renders as literal text (NFR-SEC-007)", async ({
    page,
  }) => {
    const email = uniqueTestEmail("xss");
    const maliciousName = "<script>window.__xss = true</script>";

    await page.goto("/sign-up");
    await page.getByLabel("Name").fill(maliciousName);
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(PASSWORD);
    await page.getByLabel(/I confirm I am 16 years of age or older/).check();
    await page.getByRole("button", { name: /create account/i }).click();

    await expect(page).toHaveURL(/\/onboarding$/);
    await page.getByRole("radio", { name: /Not sure yet/i }).check();
    await page.getByRole("radio", { name: /Intermediate/i }).check();
    await page.getByRole("button", { name: /continue to dashboard/i }).click();

    await expect(page).toHaveURL(/\/dashboard$/);
    // Rendered as literal text, not executed: the script never ran, and
    // the heading contains the raw angle-bracket text.
    const executed = await page.evaluate(() => (window as { __xss?: boolean }).__xss);
    expect(executed).toBeUndefined();
    await expect(page.getByRole("heading", { name: /welcome,/i })).toContainText(maliciousName);
  });
});
