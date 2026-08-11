import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { countVerificationRowsForUserId, findTestUserByEmail, uniqueTestEmail } from "./helpers/db";
import { readLatestMailFor } from "./helpers/mail";
import { registerAndOnboard } from "./helpers/register";
import { completeContentItems } from "./helpers/progress";
import { clickStar } from "./helpers/rating";

const PASSWORD = "correct-horse-battery-staple";
// Deliberately not "ai-foundations-for-builders" / "getting-started-with-
// machine-learning" / "understanding-ai-capabilities" — those are rated
// exclusively (with exact aggregate-count assertions) by
// e2e/rating-course.spec.ts, e2e/rating-path.spec.ts, and
// e2e/rating-flag.spec.ts respectively; a distinct course here avoids
// corrupting their aggregates against the same shared, seeded course.
const COURSE_URL = "/courses/ai-literacy-for-leaders";
const COURSE_SLUG = "ai-literacy-for-leaders";

// FR-ACC-007, NFR-COMP-004: export and hard delete.
test.describe("account data export and deletion", () => {
  test("downloads a personal-data export with no password field, then deletes the account", async ({
    page,
  }) => {
    const email = uniqueTestEmail("data");
    await registerAndOnboard(page.request, {
      email,
      password: PASSWORD,
      name: "Data Rights User",
    });

    // Decision #9 (progress-tracking): complete one item first, so the
    // export's `progress` array has something real to assert on.
    const completeResponse = await page.request.post("/api/progress", {
      data: { contentItemSlug: "what-is-artificial-intelligence", action: "complete" },
    });
    expect(completeResponse.ok()).toBe(true);

    await page.goto("/account");

    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("link", { name: /download my data/i }).click(),
    ]);

    const downloadPath = await download.path();
    expect(downloadPath).not.toBeNull();
    const contents = readFileSync(downloadPath as string, "utf-8");
    const exportPayload = JSON.parse(contents);

    expect(exportPayload.profile.email).toBe(email);
    expect(contents.toLowerCase()).not.toContain('"password"');
    expect(contents).not.toContain("token");

    // Decision #9: the export includes a progress entry for the completed
    // item, addressed by slug (never the underlying cuid).
    expect(exportPayload.progress).toContainEqual(
      expect.objectContaining({
        slug: "what-is-artificial-intelligence",
        status: "COMPLETE",
      }),
    );

    // Danger zone: typed confirmation must match exactly before the
    // button enables.
    const deleteButton = page.getByRole("button", {
      name: /permanently delete my account/i,
    });
    await expect(deleteButton).toBeDisabled();
    await page.getByLabel(new RegExp(`Type ${email}`, "i")).fill(email);
    await expect(deleteButton).toBeEnabled();
    await deleteButton.click();

    await expect(page).toHaveURL(/\/account-deleted$/);

    // The account and its credentials are gone.
    await page.goto("/sign-in");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(PASSWORD);
    await page.getByRole("button", { name: /sign in/i }).click();
    await expect(page.getByText("Incorrect email or password.")).toBeVisible();

    // A deletion confirmation email landed in the outbox.
    const message = await readLatestMailFor(email);
    expect(message.subject).toMatch(/account has been deleted/i);
  });

  // REVIEW.md C3: Verification rows (e.g. a password-reset token) must be
  // gone once the account is deleted, not left orphaned.
  test("deleting the account also removes its Verification rows", async ({ page }) => {
    const email = uniqueTestEmail("verify-cascade");
    await registerAndOnboard(page.request, {
      email,
      password: PASSWORD,
      name: "Cascade User",
    });

    // Create a real Verification row for this user (identifier
    // `reset-password:<token>`, backfilled `userId`) via the actual
    // forgot-password flow, the same one auth-password-reset.spec.ts uses.
    await page.goto("/forgot-password");
    await page.getByLabel("Email").fill(email);
    await page.getByRole("button", { name: /send reset link/i }).click();
    await expect(page.getByRole("status")).toContainText(/if an account exists/i);

    const userBeforeDeletion = await findTestUserByEmail(email);
    expect(userBeforeDeletion).not.toBeNull();
    const userId = userBeforeDeletion!.id;

    await expect
      .poll(() => countVerificationRowsForUserId(userId), {
        message: "expected the password-reset request to create a backfilled Verification row",
      })
      .toBeGreaterThan(0);

    await page.goto("/account");
    const deleteButton = page.getByRole("button", {
      name: /permanently delete my account/i,
    });
    await page.getByLabel(new RegExp(`Type ${email}`, "i")).fill(email);
    await expect(deleteButton).toBeEnabled();
    await deleteButton.click();
    await expect(page).toHaveURL(/\/account-deleted$/);

    expect(await countVerificationRowsForUserId(userId)).toBe(0);
  });

  // ratings-and-feedback work item, decision #9: ratings and flags are
  // personal data too — exported with target slugs/titles (never a cuid)
  // and still no secret or other user's email.
  test("the export includes a ratings entry and a ratingFlags entry after rating a course and flagging another user's rating", async ({
    page,
    browser,
  }) => {
    const otherEmail = uniqueTestEmail("data-rating-other");
    const otherContext = await browser.newContext();
    const otherPage = await otherContext.newPage();
    await registerAndOnboard(
      otherPage.request,
      { email: otherEmail, password: PASSWORD, name: "Other Feedback Author" },
      { roleArchetype: "TECHNICAL_BUILDER", level: "ZERO_KNOWLEDGE" },
    );
    await completeContentItems(otherPage.request, ["what-is-artificial-intelligence"]);
    const otherRatingResponse = await otherPage.request.post("/api/ratings", {
      data: {
        targetType: "course",
        targetSlug: COURSE_SLUG,
        stars: 2,
        feedback: "Someone else's feedback to flag.",
      },
    });
    expect(otherRatingResponse.ok()).toBe(true);
    const otherRating = (await otherRatingResponse.json()).rating;
    await otherContext.close();

    const email = uniqueTestEmail("data-rating");
    await registerAndOnboard(
      page.request,
      { email, password: PASSWORD, name: "Data Rights Rating User" },
      { roleArchetype: "TECHNICAL_BUILDER", level: "ZERO_KNOWLEDGE" },
    );
    await completeContentItems(page.request, ["what-is-artificial-intelligence"]);

    await page.goto(COURSE_URL);
    await clickStar(page, "5 stars");
    await page.getByLabel(/what did you think of this course/i).fill("Really enjoyed this.");
    await page.getByRole("button", { name: /^submit rating$/i }).click();
    await expect(page.getByRole("status").filter({ hasText: /submitted/i })).toBeVisible();

    const flagResponse = await page.request.post("/api/ratings/flags", {
      data: { ratingId: otherRating.id, reason: "OTHER", note: "For export-test coverage." },
    });
    expect(flagResponse.ok()).toBe(true);

    await page.goto("/account");
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("link", { name: /download my data/i }).click(),
    ]);
    const downloadPath = await download.path();
    const contents = readFileSync(downloadPath as string, "utf-8");
    const exportPayload = JSON.parse(contents);

    expect(exportPayload.ratings).toContainEqual(
      expect.objectContaining({
        targetType: "course",
        targetSlug: COURSE_SLUG,
        stars: 5,
        feedback: "Really enjoyed this.",
      }),
    );
    expect(exportPayload.ratingFlags).toContainEqual(
      expect.objectContaining({ ratingId: otherRating.id, reason: "OTHER" }),
    );

    expect(contents.toLowerCase()).not.toContain('"password"');
    expect(contents).not.toContain("token");
    expect(contents).not.toContain(otherEmail);
  });
});
