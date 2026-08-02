import { expect, test } from "@playwright/test";

// Harness proof for NFR-MAINT-004 to build on — not a real product journey.
// Real product journeys (registration, login/logout, password reset,
// profile change, export/delete) live in the other e2e/*.spec.ts files.
test.describe("smoke", () => {
  test("home page loads with the real landing-page copy and links (FR-ACC-008)", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: /ai learning platform/i })).toBeVisible();
    // Task 32 (learning-paths-content): the primary call to action links
    // into the content surface, anonymously — no session required.
    await expect(page.getByRole("link", { name: /browse learning paths/i })).toHaveAttribute(
      "href",
      "/paths",
    );
    await expect(page.getByRole("link", { name: /get started/i })).toHaveAttribute(
      "href",
      "/sign-up",
    );
    // "Sign in" appears both in the site header and the landing page body
    // — assert at least one resolves to the right destination rather than
    // requiring a single unique match.
    await expect(page.locator('a[href="/sign-in"]').first()).toBeVisible();
    await expect(page.getByText(/browse without an account/i)).toBeVisible();

    // Header nav — "Paths" and "Glossary" are visible to anonymous
    // visitors too (FR-ACC-008).
    await expect(page.getByRole("link", { name: /^paths$/i })).toHaveAttribute("href", "/paths");
    await expect(page.getByRole("link", { name: /^glossary$/i })).toHaveAttribute(
      "href",
      "/glossary",
    );
  });

  test("health endpoint returns 200", async ({ request }) => {
    const response = await request.get("/api/health");
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body).toEqual({ status: "ok" });
  });
});
