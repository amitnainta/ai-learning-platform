import { expect, test } from "@playwright/test";

// Harness proof for NFR-MAINT-004 to build on — not a real product journey.
test.describe("smoke", () => {
  test("home page loads", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: /ai learning platform/i })).toBeVisible();
  });

  test("health endpoint returns 200", async ({ request }) => {
    const response = await request.get("/api/health");
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body).toEqual({ status: "ok" });
  });
});
