import { expect, test } from "@playwright/test";
import { findRatingFlagsForEmail, uniqueTestEmail } from "./helpers/db";
import { registerAndOnboard } from "./helpers/register";
import { completeContentItems } from "./helpers/progress";

const PASSWORD = "correct-horse-battery-staple";
const COURSE_URL = "/courses/ai-foundations-for-builders";

// FR-RATE-006: any signed-in user can flag someone else's rating with a
// reason; the flag records but never hides the rating (decision #5).
test.describe("rating: flag", () => {
  test("user B reports user A's feedback; a durable RatingFlag row is created and the rating stays visible", async ({
    browser,
  }) => {
    const emailA = uniqueTestEmail("rating-flag-author");
    const emailB = uniqueTestEmail("rating-flag-reporter");

    const contextA = await browser.newContext();
    const pageA = await contextA.newPage();
    await registerAndOnboard(
      pageA.request,
      { email: emailA, password: PASSWORD, name: "Feedback Author" },
      { roleArchetype: "TECHNICAL_BUILDER", level: "ZERO_KNOWLEDGE" },
    );
    await completeContentItems(pageA.request, ["what-is-artificial-intelligence"]);

    await pageA.goto(COURSE_URL);
    await pageA.getByRole("radio", { name: "2 stars" }).click();
    await pageA.getByLabel(/what did you think of this course/i).fill("This needs more examples.");
    await pageA.getByRole("button", { name: /^submit rating$/i }).click();
    await expect(pageA.getByRole("status").filter({ hasText: /submitted/i })).toBeVisible();
    await expect(pageA.getByText("This needs more examples.")).toBeVisible();

    // The author sees no report control on their own rating.
    await expect(pageA.getByRole("button", { name: /^report/i })).toHaveCount(0);
    await contextA.close();

    const contextB = await browser.newContext();
    const pageB = await contextB.newPage();
    await registerAndOnboard(
      pageB.request,
      { email: emailB, password: PASSWORD, name: "Feedback Reporter" },
      { roleArchetype: "TECHNICAL_BUILDER", level: "ZERO_KNOWLEDGE" },
    );

    await pageB.goto(COURSE_URL);
    await expect(pageB.getByText("This needs more examples.")).toBeVisible();

    const reportButton = pageB.getByRole("button", { name: /report feedback author's rating/i });
    await reportButton.click();
    await pageB.getByRole("radio", { name: "Inappropriate" }).click();
    await pageB.getByLabel(/note/i).fill("Testing the report flow.");
    await pageB.getByRole("button", { name: /submit report/i }).click();
    await expect(pageB.getByText(/reported — thank you/i)).toBeVisible();

    const flagsAfterFirstReport = await findRatingFlagsForEmail(emailB);
    expect(flagsAfterFirstReport).toHaveLength(1);
    expect(flagsAfterFirstReport[0]?.reason).toBe("INAPPROPRIATE");

    // The flagged rating remains visible — a flag records, it doesn't censor.
    await pageB.reload();
    await expect(pageB.getByText("This needs more examples.")).toBeVisible();

    // A second report by the same user does not create a second row.
    const secondFlagResponse = await pageB.request.post("/api/ratings/flags", {
      data: { ratingId: flagsAfterFirstReport[0]!.ratingId, reason: "SPAM" },
    });
    expect(secondFlagResponse.ok()).toBe(true);
    const flagsAfterSecondReport = await findRatingFlagsForEmail(emailB);
    expect(flagsAfterSecondReport).toHaveLength(1);
    expect(flagsAfterSecondReport[0]?.reason).toBe("SPAM");

    await contextB.close();
  });
});
