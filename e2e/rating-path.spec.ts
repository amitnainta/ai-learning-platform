import { expect, test } from "@playwright/test";
import { findRatingsForEmail, uniqueTestEmail } from "./helpers/db";
import { registerAndOnboard } from "./helpers/register";
import { completeContentItems, TECHNICAL_BUILDER_ZERO_KNOWLEDGE_ITEMS } from "./helpers/progress";
import { clickStar } from "./helpers/rating";

const PASSWORD = "correct-horse-battery-staple";
const PATH_URL = "/paths/technical-builder/zero-knowledge";

// FR-RATE-003/004/008: a path can only be rated once every currently-
// published item is COMPLETE; below that, both the UI and a direct API
// write are refused.
//
// Rates "getting-started-with-machine-learning" (this path's second
// course) for the per-course-aggregate check below — deliberately not
// "ai-foundations-for-builders", which e2e/rating-course.spec.ts rates
// exclusively and asserts an exact aggregate count against; the two
// specs would otherwise corrupt each other's aggregate assertions against
// the same shared, seeded course.
test.describe("rating: path", () => {
  test("path gate refuses below 100% (UI and a direct 403), then rating a completed path with role/level feedback; per-course aggregate reflects a course rating", async ({
    page,
  }) => {
    const email = uniqueTestEmail("rating-path");
    await registerAndOnboard(
      page.request,
      { email, password: PASSWORD, name: "Rating Path User" },
      { roleArchetype: "TECHNICAL_BUILDER", level: "ZERO_KNOWLEDGE" },
    );

    await page.goto(PATH_URL);
    const pathRatingHeading = page.getByRole("heading", { name: /rate this path/i });
    await expect(pathRatingHeading).toBeVisible();
    await expect(page.getByText(/complete every item in this path/i)).toBeVisible();
    await expect(page.getByRole("group", { name: /your rating/i })).toHaveCount(0);

    // A direct write is refused server-side too, and writes no row.
    const directWrite = await page.request.post("/api/ratings", {
      data: { targetType: "path", targetSlug: "technical-builder-zero-knowledge", stars: 5 },
    });
    expect(directWrite.status()).toBe(403);
    expect(await findRatingsForEmail(email)).toHaveLength(0);

    // Complete the whole path, then rate its second course.
    await completeContentItems(page.request, TECHNICAL_BUILDER_ZERO_KNOWLEDGE_ITEMS);
    const courseRatingResponse = await page.request.post("/api/ratings", {
      data: {
        targetType: "course",
        targetSlug: "getting-started-with-machine-learning",
        stars: 3,
      },
    });
    expect(courseRatingResponse.ok()).toBe(true);

    await page.goto(PATH_URL);
    await expect(page.getByRole("group", { name: /your rating/i })).toBeVisible();
    await expect(page.getByText(/did this path fit your role and level/i)).toBeVisible();

    await clickStar(page, "5 stars");
    await page
      .getByLabel(/did this path fit your role and level/i)
      .fill("Perfect fit for a zero-knowledge technical builder.");
    await page.getByRole("button", { name: /^submit rating$/i }).click();
    await expect(page.getByRole("status").filter({ hasText: /submitted/i })).toBeVisible();

    await expect(page.getByText("5 out of 5 - 1 rating").first()).toBeVisible();
    await expect(
      page
        .getByRole("paragraph")
        .filter({ hasText: "Perfect fit for a zero-knowledge technical builder." }),
    ).toBeVisible();

    // The per-course aggregate on the path page reflects the course rating
    // submitted earlier in this test.
    const courseCard = page
      .locator("section")
      .filter({ hasText: "Getting Started with Machine Learning" });
    await expect(courseCard.getByText("3 out of 5 - 1 rating")).toBeVisible();
  });
});
