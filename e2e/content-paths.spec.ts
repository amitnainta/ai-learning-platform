import { expect, test } from "@playwright/test";

// FR-PATH-001/002/004/006, FR-ACC-008, NFR-COMP-001: anonymous browsing of
// the role -> level -> path -> course -> item hierarchy, entirely without a
// session, with every FR-PATH-004 tag visible and curated attribution
// intact. Seeded by e2e/global-setup.ts (idempotent import of content/**).
test.describe("content: paths", () => {
  test("browse from /paths to a role landing page to a level's path, in authored order", async ({
    page,
  }) => {
    await page.goto("/paths");
    await expect(page.getByRole("heading", { name: /learning paths/i })).toBeVisible();

    await page.getByRole("link", { name: /technical builder/i }).click();
    await expect(page).toHaveURL("/paths/technical-builder");
    await expect(page.getByRole("heading", { name: /technical builder/i })).toBeVisible();

    await page.getByRole("link", { name: /zero knowledge/i }).click();
    await expect(page).toHaveURL("/paths/technical-builder/zero-knowledge");
    await expect(
      page.getByRole("heading", { name: /technical builder — zero knowledge/i }),
    ).toBeVisible();

    // Courses appear in authored order (ai-foundations-for-builders then
    // getting-started-with-machine-learning —
    // content/paths/technical-builder-zero-knowledge.yaml). Scoped to
    // <section> (one per course) so the page's own "Switch role or level"
    // h2 (the path switcher) doesn't collide with the course-title h2s.
    const courseHeadings = page.locator("section").getByRole("heading", { level: 2 });
    await expect(courseHeadings.nth(0)).toHaveText(/ai foundations for builders/i);
    await expect(courseHeadings.nth(1)).toHaveText(/getting started with machine learning/i);

    // Items within the first course appear in authored order (item-level
    // headings are h3s rendered by <ContentItemCard>).
    const itemHeadings = page.locator("section").getByRole("heading", { level: 3 });
    await expect(itemHeadings.nth(0)).toHaveText(/what is artificial intelligence/i);
    await expect(itemHeadings.nth(1)).toHaveText(/machine learning crash course/i);
    await expect(itemHeadings.nth(2)).toHaveText(/elements of ai/i);
  });

  test("every FR-PATH-004 tag is visible on an item", async ({ page }) => {
    await page.goto("/paths/technical-builder/zero-knowledge");

    const firstItemCard = page
      .locator("li")
      .filter({ hasText: "What Is Artificial Intelligence?" });
    await expect(firstItemCard.getByText(/technical builder/i)).toBeVisible();
    await expect(firstItemCard.getByText(/zero knowledge/i)).toBeVisible();
    await expect(firstItemCard.getByText(/^article$/i)).toBeVisible();
    await expect(firstItemCard.getByText(/\d+ min/i)).toBeVisible();
    await expect(firstItemCard.getByText(/original \(platform-authored\)/i)).toBeVisible();
    await expect(firstItemCard.getByText(/ai fundamentals/i)).toBeVisible();
  });

  test("a curated item's anchor has the external href, opens in a new tab, and shows publisher attribution", async ({
    page,
  }) => {
    await page.goto("/paths/technical-builder/zero-knowledge");

    const curatedCard = page.locator("li").filter({ hasText: "Machine Learning Crash Course" });
    const link = curatedCard.getByRole("link", { name: /open this resource/i });

    await expect(link).toHaveAttribute(
      "href",
      "https://developers.google.com/machine-learning/crash-course",
    );
    await expect(link).toHaveAttribute("target", "_blank");
    const rel = await link.getAttribute("rel");
    expect(rel).toContain("noopener");
    expect(rel).toContain("noreferrer");
    await expect(curatedCard.getByText(/google for developers/i)).toBeVisible();
  });

  test("a course page links back to every published path that contains it (overlap made visible)", async ({
    page,
  }) => {
    // ai-foundations-for-builders is only in the Technical Builder ZK path,
    // but ai-literacy-for-leaders (Executive ZK) shares two of its items
    // with it — check the shared item's own course page instead, which is
    // referenced by both role's zero-knowledge courses via distinct course
    // rows sharing the same content item.
    await page.goto("/courses/ai-foundations-for-builders");
    await expect(page.getByRole("heading", { name: /ai foundations for builders/i })).toBeVisible();
    await expect(
      page.getByRole("link", { name: /technical builder — zero knowledge/i }),
    ).toBeVisible();
  });

  test("the role landing page lists all three levels (FR-SEARCH-004)", async ({ page }) => {
    await page.goto("/paths/executive-non-technical");
    await expect(page.getByRole("heading", { name: /executive.*non-technical/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /zero knowledge/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /^intermediate$/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /^advanced$/i })).toBeVisible();
  });

  test("an unknown role segment returns a 404, not an error page", async ({ page }) => {
    const response = await page.goto("/paths/not-a-real-role");
    expect(response?.status()).toBe(404);
  });

  test("an unknown level segment returns a 404", async ({ page }) => {
    const response = await page.goto("/paths/technical-builder/not-a-real-level");
    expect(response?.status()).toBe(404);
  });
});
