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

    // Scoped to the "current path" section — with the shared item already
    // complete, the retained Executive path's own bars can otherwise show
    // coincidentally identical counts/percentages later in this test, which
    // would make an unscoped page-wide text search ambiguous.
    const currentPathSection = page.getByRole("region", {
      name: /technical builder.*zero knowledge — current path/i,
    });

    const pathBar = currentPathSection.getByRole("progressbar", {
      name: /technical builder.*zero knowledge progress/i,
    });
    await expect(pathBar).toHaveAttribute("aria-valuenow", "40");
    await expect(pathBar).toHaveAttribute("aria-valuetext", "2 of 5 items complete (40%)");

    const course1Bar = currentPathSection.getByRole("progressbar", {
      name: /ai foundations for builders progress/i,
    });
    await expect(course1Bar).toHaveAttribute("aria-valuenow", "33");
    await expect(course1Bar).toHaveAttribute("aria-valuetext", "1 of 3 items complete (33%)");

    const course2Bar = currentPathSection.getByRole("progressbar", {
      name: /getting started with machine learning progress/i,
    });
    await expect(course2Bar).toHaveAttribute("aria-valuenow", "50");
    await expect(course2Bar).toHaveAttribute("aria-valuetext", "1 of 2 items complete (50%)");

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
    const retainedSection = page.getByRole("region", {
      name: /technical builder.*zero knowledge — previously followed path/i,
    });
    await expect(retainedSection).toBeVisible();
    const retainedPathBar = retainedSection.getByRole("progressbar", {
      name: /technical builder.*zero knowledge progress/i,
    });
    await expect(retainedPathBar).toHaveAttribute("aria-valuenow", "40");
  });
});

// B1 regression coverage: ENGINEERING_LEADER and INVESTOR are selectable
// roles (role-level-form.tsx) with no published R1 path
// (content/paths/ only covers technical-builder-* and
// executive-non-technical-*). Before the fix, `getPathForRoleLevel()`
// returning null for these users was masked by a `hasPath` check that only
// looked at whether role/level fields were set, so they saw a dashboard
// with no path cards and no "browse paths" fallback — a dead end.
test.describe("progress: dashboard fallback when the user's role/level has no published path", () => {
  test("a role with no path and no prior progress sees the browse-paths fallback, not a dead end", async ({
    page,
  }) => {
    const email = uniqueTestEmail("progress-dashboard-no-path");
    await registerAndOnboard(
      page.request,
      { email, password: PASSWORD, name: "No Path User" },
      { roleArchetype: "ENGINEERING_LEADER", level: "ZERO_KNOWLEDGE" },
    );

    await page.goto("/dashboard");

    await expect(page.getByRole("heading", { name: "Browse learning paths" })).toBeVisible();
    await expect(
      page.getByText("No path is available for your current role and level yet."),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: /browse paths/i })).toBeVisible();

    // No dead end: no stray progress region rendered either.
    await expect(page.getByRole("region", { name: /— current path/i })).toHaveCount(0);
    await expect(page.getByRole("region", { name: /— previously followed path/i })).toHaveCount(0);
  });

  test("a role with no path but progress on a previously-followed path still sees that path card, not the fallback", async ({
    page,
  }) => {
    const email = uniqueTestEmail("progress-dashboard-no-path-retained");
    await registerAndOnboard(
      page.request,
      { email, password: PASSWORD, name: "No Path Retained User" },
      { roleArchetype: "TECHNICAL_BUILDER", level: "ZERO_KNOWLEDGE" },
    );

    const response = await page.request.post("/api/progress", {
      data: { contentItemSlug: "what-is-artificial-intelligence", action: "complete" },
    });
    expect(response.ok()).toBe(true);

    // Switch to a role with no published path — the user keeps their
    // Technical Builder progress, which decision #7 says must stay visible.
    const profileResponse = await page.request.patch("/api/account/profile", {
      data: { roleArchetype: "ENGINEERING_LEADER", level: "ZERO_KNOWLEDGE" },
    });
    expect(profileResponse.ok()).toBe(true);

    await page.goto("/dashboard");

    const retainedSection = page.getByRole("region", {
      name: /technical builder.*zero knowledge — previously followed path/i,
    });
    await expect(retainedSection).toBeVisible();

    // The browse-paths fallback is not needed once a retained path with
    // progress is shown.
    await expect(page.getByRole("heading", { name: "Browse learning paths" })).toHaveCount(0);
  });
});
