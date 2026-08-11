import { expect, test } from "@playwright/test";
import { uniqueTestEmail } from "./helpers/db";
import { registerAndOnboard } from "./helpers/register";
import { completeContentItems } from "./helpers/progress";
import { clickStar } from "./helpers/rating";

const PASSWORD = "correct-horse-battery-staple";
const XSS_PAYLOAD = "<script>window.__xssFired = true;</script>Great course overall!";

// FR-RATE-001/002/005, NFR-SEC-007: rate a course, leave feedback, see the
// aggregate change, be refused by the FR-RATE-008 gate before starting, and
// confirm a script payload never executes and renders as literal text.
test.describe("rating: course", () => {
  test("gate before starting, rate with an XSS payload, aggregate updates, edit, remove, anonymous view", async ({
    page,
  }) => {
    // Fail loudly if the XSS payload ever triggers a real dialog.
    page.on("dialog", (dialog) => {
      throw new Error(`Unexpected dialog (XSS executed): ${dialog.message()}`);
    });

    const email = uniqueTestEmail("rating-course");
    await registerAndOnboard(
      page.request,
      { email, password: PASSWORD, name: "Rating Course User" },
      { roleArchetype: "TECHNICAL_BUILDER", level: "ZERO_KNOWLEDGE" },
    );

    await page.goto("/courses/ai-foundations-for-builders");
    await expect(page.getByText("Not yet rated").first()).toBeVisible();
    await expect(page.getByText(/start this course to leave a rating/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /submit rating/i })).toHaveCount(0);

    // Complete one item in the course to become eligible.
    await completeContentItems(page.request, ["what-is-artificial-intelligence"]);

    await page.reload();
    await expect(page.getByRole("group", { name: /your rating/i })).toBeVisible();

    await clickStar(page, "4 stars");
    await page.getByLabel(/what did you think of this course/i).fill(XSS_PAYLOAD);
    await page.getByRole("button", { name: /^submit rating$/i }).click();
    await expect(page.getByRole("status").filter({ hasText: /submitted/i })).toBeVisible();

    // Aggregate updated, no page-wide alert fired.
    await expect(page.getByText("4 out of 5 - 1 rating").first()).toBeVisible();
    expect(
      await page.evaluate(() => (window as { __xssFired?: boolean }).__xssFired),
    ).toBeUndefined();

    // The feedback renders as literal visible text, not a live <script> tag —
    // scoped to the rendered <p> in the feedback list, not the form's own
    // <textarea> (which still holds the just-submitted value too).
    await expect(page.getByRole("paragraph").filter({ hasText: XSS_PAYLOAD })).toBeVisible();
    expect(await page.locator("script", { hasText: "__xssFired" }).count()).toBe(0);

    // The author's name/role/level are shown alongside the feedback, in the
    // rating list entry's own byline (scoped to avoid matching unrelated
    // "Technical Builder" text elsewhere on the page, e.g. path links/tags).
    await expect(page.getByText("Rating Course User")).toBeVisible();
    await expect(page.getByText(/technical builder · zero knowledge/i)).toBeVisible();

    // Edit to 5 stars.
    await clickStar(page, "5 stars");
    await page.getByRole("button", { name: /update your rating/i }).click();
    await expect(page.getByRole("status").filter({ hasText: /updated/i })).toBeVisible();
    await expect(page.getByText("5 out of 5 - 1 rating").first()).toBeVisible();

    // Remove the rating — the page returns to "Not yet rated".
    await page.getByRole("button", { name: /remove my rating/i }).click();
    await expect(page.getByRole("status").filter({ hasText: /removed/i })).toBeVisible();
    await expect(page.getByText("Not yet rated").first()).toBeVisible();

    // Anonymous visitor: aggregate visible, sign-in prompt, no form.
    await page.context().clearCookies();
    await page.reload();
    await expect(page.getByText("Not yet rated").first()).toBeVisible();
    await expect(page.getByRole("link", { name: /sign in/i }).first()).toBeVisible();
    await expect(page.getByRole("group", { name: /your rating/i })).toHaveCount(0);
  });
});
