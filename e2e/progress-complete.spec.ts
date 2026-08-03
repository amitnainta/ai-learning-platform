import { expect, test } from "@playwright/test";
import { findProgressForEmail, uniqueTestEmail } from "./helpers/db";
import { registerAndOnboard } from "./helpers/register";

const PASSWORD = "correct-horse-battery-staple";

// FR-PROG-001: the three-state completion lifecycle, for both an original
// lesson (auto-"in progress" on open, explicit "mark complete") and a
// curated item (no detail page — completion lives on the card).
test.describe("progress: mark complete", () => {
  test("an original lesson moves not started -> in progress (auto) -> complete -> reversible, and persists", async ({
    page,
  }) => {
    const email = uniqueTestEmail("progress-complete");
    await registerAndOnboard(
      page.request,
      { email, password: PASSWORD, name: "Progress Complete User" },
      { roleArchetype: "TECHNICAL_BUILDER", level: "ZERO_KNOWLEDGE" },
    );

    await page.goto("/paths/technical-builder/zero-knowledge");
    const firstItemCard = page
      .locator("li")
      .filter({ hasText: "What Is Artificial Intelligence?" });
    await expect(firstItemCard.getByText("Not started")).toBeVisible();

    // Opening the lesson fires the auto-view beacon.
    await page.getByRole("link", { name: /what is artificial intelligence/i }).click();
    await expect(page).toHaveURL("/lessons/what-is-artificial-intelligence");

    await page.goto("/paths/technical-builder/zero-knowledge");
    await expect(firstItemCard.getByText("In progress")).toBeVisible();

    // Mark complete on the lesson page.
    await page.goto("/lessons/what-is-artificial-intelligence");
    await page.getByRole("button", { name: /mark complete/i }).click();
    await expect(page.getByRole("button", { name: /mark as not complete/i })).toBeVisible();
    await expect(page.getByText("Complete", { exact: true })).toBeVisible();

    // Persists across a reload.
    await page.reload();
    await expect(page.getByRole("button", { name: /mark as not complete/i })).toBeVisible();

    const rowsAfterComplete = await findProgressForEmail(email);
    const lessonRow = rowsAfterComplete.find(
      (row) => row.contentItem.slug === "what-is-artificial-intelligence",
    );
    expect(rowsAfterComplete.filter((row) => row.status === "COMPLETE")).toHaveLength(1);
    expect(lessonRow?.status).toBe("COMPLETE");
    expect(lessonRow?.completedAt).not.toBeNull();

    // Reversible.
    await page.getByRole("button", { name: /mark as not complete/i }).click();
    await expect(page.getByRole("button", { name: /^mark complete/i })).toBeVisible();
  });

  test("a curated item can be completed from its card (no detail page)", async ({ page }) => {
    const email = uniqueTestEmail("progress-curated");
    await registerAndOnboard(
      page.request,
      { email, password: PASSWORD, name: "Progress Curated User" },
      { roleArchetype: "TECHNICAL_BUILDER", level: "ZERO_KNOWLEDGE" },
    );

    await page.goto("/paths/technical-builder/zero-knowledge");
    const curatedCard = page.locator("li").filter({ hasText: "Machine Learning Crash Course" });
    await expect(curatedCard.getByText("Not started")).toBeVisible();

    await curatedCard.getByRole("button", { name: /mark complete/i }).click();
    await expect(curatedCard.getByRole("button", { name: /mark as not complete/i })).toBeVisible();
    await expect(curatedCard.getByText("Complete", { exact: true })).toBeVisible();

    const rows = await findProgressForEmail(email);
    const curatedRow = rows.find((row) => row.contentItem.slug === "google-ai-crash-course");
    expect(curatedRow?.status).toBe("COMPLETE");
  });

  test("an anonymous visitor sees no progress controls and no status badges", async ({ page }) => {
    await page.goto("/paths/technical-builder/zero-knowledge");

    await expect(page.getByRole("button", { name: /mark complete/i })).toHaveCount(0);
    await expect(page.getByText("Not started")).toHaveCount(0);
    await expect(page.getByText("In progress")).toHaveCount(0);
  });
});
