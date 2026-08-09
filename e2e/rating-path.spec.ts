import { expect, test } from "@playwright/test";
import { findRatingsForEmail, uniqueTestEmail } from "./helpers/db";
import { registerAndOnboard } from "./helpers/register";
import { completeContentItems, TECHNICAL_BUILDER_ZERO_KNOWLEDGE_ITEMS } from "./helpers/progress";

const PASSWORD = "correct-horse-battery-staple";
const PATH_URL = "/paths/technical-builder/zero-knowledge";

// FR-RATE-003/004/008: a path can only be rated once every currently-
// published item is COMPLETE; below that, both the UI and a direct API
// write are refused.
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

    // Rate the first course while we're here, to check the per-course
    // aggregate on the path page below.
    await completeContentItems(page.request, ["what-is-artificial-intelligence"]);
    const courseRatingResponse = await page.request.post("/api/ratings", {
      data: { targetType: "course", targetSlug: "ai-foundations-for-builders", stars: 3 },
    });
    expect(courseRatingResponse.ok()).toBe(true);

    // Complete the rest of the path.
    await completeContentItems(
      page.request,
      TECHNICAL_BUILDER_ZERO_KNOWLEDGE_ITEMS.filter(
        (slug) => slug !== "what-is-artificial-intelligence",
      ),
    );

    await page.goto(PATH_URL);
    await expect(page.getByRole("group", { name: /your rating/i })).toBeVisible();
    await expect(page.getByText(/did this path fit your role and level/i)).toBeVisible();

    await page.getByRole("radio", { name: "5 stars" }).click();
    await page
      .getByLabel(/did this path fit your role and level/i)
      .fill("Perfect fit for a zero-knowledge technical builder.");
    await page.getByRole("button", { name: /^submit rating$/i }).click();
    await expect(page.getByRole("status").filter({ hasText: /submitted/i })).toBeVisible();

    await expect(page.getByText("5 out of 5 - 1 rating").first()).toBeVisible();
    await expect(
      page.getByText("Perfect fit for a zero-knowledge technical builder."),
    ).toBeVisible();

    // The per-course aggregate on the path page reflects the course rating
    // submitted earlier in this test.
    const courseCard = page.locator("section").filter({ hasText: "AI Foundations for Builders" });
    await expect(courseCard.getByText("3 out of 5 - 1 rating")).toBeVisible();
  });
});
