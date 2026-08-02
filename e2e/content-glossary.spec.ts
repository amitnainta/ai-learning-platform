import { expect, test } from "@playwright/test";

// FR-PATH-008, FR-ACC-008: the glossary index and a term page, both
// reachable anonymously.
test.describe("content: glossary", () => {
  test("/glossary lists terms alphabetically with their short definitions", async ({ page }) => {
    await page.goto("/glossary");
    await expect(page.getByRole("heading", { name: /^glossary$/i })).toBeVisible();

    const termLink = page.getByRole("link", { name: /^algorithm$/i });
    await expect(termLink).toBeVisible();
    await expect(page.getByText(/step-by-step procedure/i)).toBeVisible();

    // "Algorithm" (A) must appear before "Token" (T) in document order —
    // the index is alphabetical.
    const algorithmIndex = await termLink.evaluate((node) => {
      const all = Array.from(document.querySelectorAll("a"));
      return all.indexOf(node as HTMLAnchorElement);
    });
    const tokenLink = page.getByRole("link", { name: /^token$/i });
    const tokenIndex = await tokenLink.evaluate((node) => {
      const all = Array.from(document.querySelectorAll("a"));
      return all.indexOf(node as HTMLAnchorElement);
    });
    expect(algorithmIndex).toBeLessThan(tokenIndex);
  });

  test("a term page shows the long definition and related terms, reachable anonymously", async ({
    page,
  }) => {
    await page.goto("/glossary/machine-learning");

    await expect(
      page.getByRole("heading", { name: /^machine learning$/i, level: 1 }),
    ).toBeVisible();
    await expect(page.getByText(/dominant approach behind modern/i)).toBeVisible();

    const relatedHeading = page.getByRole("heading", { name: /related terms/i });
    await expect(relatedHeading).toBeVisible();
    // "Artificial intelligence" also appears as an inline contextual
    // glossary link inside the body text above — the related-terms pill is
    // the one that comes after the "Related terms" heading in document
    // order, so scope to whichever match renders last.
    await expect(
      page.getByRole("link", { name: /^artificial intelligence$/i }).last(),
    ).toBeVisible();

    await expect(page.getByRole("link", { name: /← glossary/i })).toHaveAttribute(
      "href",
      "/glossary",
    );
  });

  test("an unknown term slug returns a 404", async ({ page }) => {
    const response = await page.goto("/glossary/not-a-real-term");
    expect(response?.status()).toBe(404);
  });
});
