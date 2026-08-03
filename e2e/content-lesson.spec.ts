import { expect, test } from "@playwright/test";

// FR-PATH-005/007/008: an original lesson opened from its path — rendered
// Markdown, last-reviewed date, tags, the sample-content notice
// (decision #13), and a contextual glossary link that navigates to the
// term page. Deliberately asserts no <video> element: the R1 seed pack
// ships no video asset at all (decision #4) — the FR-PATH-005 video markup
// itself is proven by src/components/content/__tests__/lesson-video.test.tsx.
test.describe("content: lesson", () => {
  test("opening an original lesson from its path renders the body, tags, and the sample-content notice", async ({
    page,
  }) => {
    await page.goto("/paths/technical-builder/zero-knowledge");
    await page.getByRole("link", { name: /what is artificial intelligence/i }).click();

    await expect(page).toHaveURL("/lessons/what-is-artificial-intelligence");
    await expect(
      page.getByRole("heading", { name: /what is artificial intelligence/i, level: 1 }),
    ).toBeVisible();

    // Rendered Markdown: a heading from the body and a list.
    await expect(
      page.getByRole("heading", { name: /how is this different from regular software/i }),
    ).toBeVisible();
    await expect(page.getByRole("list").first()).toBeVisible();

    // Last-reviewed date and tags (FR-PATH-007/004).
    await expect(page.getByText(/last reviewed/i)).toBeVisible();
    await expect(page.getByText(/^article$/i)).toBeVisible();
    await expect(page.getByText(/original \(platform-authored\)/i)).toBeVisible();

    // Sample-content notice (decision #13).
    await expect(page.getByText(/sample content — not yet reviewed/i)).toBeVisible();

    // No <video> element anywhere on the page — the seed pack ships no
    // video asset, live or placeholder (decision #4).
    await expect(page.locator("video")).toHaveCount(0);
  });

  test("a contextual glossary link navigates to the term page", async ({ page }) => {
    await page.goto("/lessons/what-is-artificial-intelligence");

    const glossaryLink = page.getByRole("link", { name: /artificial intelligence/i }).first();
    await glossaryLink.click();

    await expect(page).toHaveURL("/glossary/artificial-intelligence");
    await expect(
      page.getByRole("heading", { name: /artificial intelligence/i, level: 1 }),
    ).toBeVisible();
  });

  test("a curated slug returns a 404 at /lessons/<slug> (curated items have no detail page)", async ({
    page,
  }) => {
    const response = await page.goto("/lessons/google-ai-crash-course");
    expect(response?.status()).toBe(404);
  });

  test("an unknown lesson slug returns a 404", async ({ page }) => {
    const response = await page.goto("/lessons/not-a-real-lesson");
    expect(response?.status()).toBe(404);
  });
});
