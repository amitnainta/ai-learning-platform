import { expect, test } from "@playwright/test";
import { uniqueTestEmail } from "./helpers/db";
import { registerAndOnboard } from "./helpers/register";

const PASSWORD = "correct-horse-battery-staple";

// FR-PROG-003 + FR-PATH-009. Technical Builder — Zero Knowledge has 5
// items across 2 courses (content/paths/technical-builder-zero-
// knowledge.yaml): ai-foundations-for-builders (3 items:
// what-is-artificial-intelligence, google-ai-crash-course,
// elements-of-ai-course) and getting-started-with-machine-learning
// (2 items: how-machine-learning-works, visual-intro-to-machine-learning).
// Completing what-is-artificial-intelligence (course 1) and
// how-machine-learning-works (course 2) gives clean, unambiguous integer
// percentages: course 1 = 1/3 = 33%, course 2 = 1/2 = 50%, path = 2/5 = 40%.
test.describe("progress: dashboard percentages and FR-PATH-009 retention", () => {
  test("dashboard percentages are exact, and a shared item stays complete across a path switch", async ({
    page,
  }) => {
    const email = uniqueTestEmail("progress-dashboard");
    await registerAndOnboard(
      page.request,
      { email, password: PASSWORD, name: "Progress Dashboard User" },
      { roleArchetype: "TECHNICAL_BUILDER", level: "ZERO_KNOWLEDGE" },
    );

    for (const slug of ["what-is-artificial-intelligence", "how-machine-learning-works"]) {
      const response = await page.request.post("/api/progress", {
        data: { contentItemSlug: slug, action: "complete" },
      });
      expect(response.ok()).toBe(true);
    }

    await page.goto("/dashboard");

    const pathBar = page.getByRole("progressbar", {
      name: /technical builder.*zero knowledge progress/i,
    });
    await expect(pathBar).toHaveAttribute("aria-valuenow", "40");
    await expect(page.getByText("2 of 5 items complete (40%)")).toBeVisible();

    const course1Bar = page.getByRole("progressbar", {
      name: /ai foundations for builders progress/i,
    });
    await expect(course1Bar).toHaveAttribute("aria-valuenow", "33");
    await expect(page.getByText("1 of 3 items complete (33%)")).toBeVisible();

    const course2Bar = page.getByRole("progressbar", {
      name: /getting started with machine learning progress/i,
    });
    await expect(course2Bar).toHaveAttribute("aria-valuenow", "50");
    await expect(page.getByText("1 of 2 items complete (50%)")).toBeVisible();

    // Switch to Executive / Non-Technical — Zero Knowledge, which shares
    // what-is-artificial-intelligence with the technical-builder path
    // (content/courses/ai-literacy-for-leaders.yaml).
    await page.getByLabel("Role").selectOption("EXECUTIVE_NON_TECHNICAL");
    await page.getByLabel("Level").selectOption("ZERO_KNOWLEDGE");
    await page.getByRole("button", { name: /switch path/i }).click();
    await expect(page).toHaveURL("/paths/executive-non-technical/zero-knowledge");

    const sharedItemCard = page
      .locator("li")
      .filter({ hasText: "What Is Artificial Intelligence?" });
    await expect(sharedItemCard.getByText("Complete", { exact: true })).toBeVisible();

    // 1 of 3 unique items (what-is-artificial-intelligence,
    // elements-of-ai-course, google-ai-crash-course) is complete = 33%.
    const newPathBar = page.getByRole("progressbar", {
      name: /executive.*non-technical.*zero knowledge progress/i,
    });
    await expect(newPathBar).toHaveAttribute("aria-valuenow", "33");

    // The previously-followed Technical Builder path is still listed on the
    // dashboard with its retained percentage (FR-PATH-009).
    await page.goto("/dashboard");
    await expect(page.getByText(/previously followed/i)).toBeVisible();
    const retainedPathBar = page.getByRole("progressbar", {
      name: /technical builder.*zero knowledge progress/i,
    });
    await expect(retainedPathBar).toHaveAttribute("aria-valuenow", "40");
  });
});
