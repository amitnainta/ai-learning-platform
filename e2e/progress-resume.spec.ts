import { expect, test } from "@playwright/test";
import { uniqueTestEmail } from "./helpers/db";
import { registerAndOnboard } from "./helpers/register";

const PASSWORD = "correct-horse-battery-staple";

// FR-PROG-002: resume advances item by item, then course by course, ending
// in the path-complete state. Technical Builder — Zero Knowledge:
// course 1 (ai-foundations-for-builders) = what-is-artificial-intelligence,
// google-ai-crash-course, elements-of-ai-course; course 2
// (getting-started-with-machine-learning) = how-machine-learning-works,
// visual-intro-to-machine-learning (content/paths/technical-builder-zero-
// knowledge.yaml).
test.describe("progress: resume", () => {
  test("resume advances item by item and course by course, ending in the path-complete state", async ({
    page,
  }) => {
    const email = uniqueTestEmail("progress-resume");
    await registerAndOnboard(
      page.request,
      { email, password: PASSWORD, name: "Progress Resume User" },
      { roleArchetype: "TECHNICAL_BUILDER", level: "ZERO_KNOWLEDGE" },
    );

    // Nothing started: "Start the path" pointing at the first item.
    await page.goto("/dashboard");
    await expect(page.getByText(/start the path/i)).toBeVisible();
    const startLink = page.getByRole("link", {
      name: /start: what is artificial intelligence\?/i,
    });
    await expect(startLink).toHaveAttribute("href", "/lessons/what-is-artificial-intelligence");

    // Complete the first item via the real UI flow.
    await page.goto("/lessons/what-is-artificial-intelligence");
    await page.getByRole("button", { name: /mark complete/i }).click();
    await expect(page.getByRole("button", { name: /mark as not complete/i })).toBeVisible();

    // Resume now names the second item (a curated card, no detail page) and
    // links to the course anchor.
    await page.goto("/dashboard");
    const resumeLink = page.getByRole("link", {
      name: /resume: machine learning crash course/i,
    });
    await expect(resumeLink).toHaveAttribute(
      "href",
      "/courses/ai-foundations-for-builders#item-google-ai-crash-course",
    );
    await resumeLink.click();
    await expect(page).toHaveURL(
      "/courses/ai-foundations-for-builders#item-google-ai-crash-course",
    );

    // Complete the rest of the first course directly via the API (already
    // UI-tested by progress-complete.spec.ts) so this test stays focused on
    // resume-target advancement.
    for (const slug of ["google-ai-crash-course", "elements-of-ai-course"]) {
      const response = await page.request.post("/api/progress", {
        data: { contentItemSlug: slug, action: "complete" },
      });
      expect(response.ok()).toBe(true);
    }

    // Resume target advances into the second course.
    await page.goto("/dashboard");
    const secondCourseResumeLink = page.getByRole("link", {
      name: /resume: how machine learning actually works/i,
    });
    await expect(secondCourseResumeLink).toHaveAttribute(
      "href",
      "/lessons/how-machine-learning-works",
    );

    // Complete the whole path.
    for (const slug of ["how-machine-learning-works", "visual-intro-to-machine-learning"]) {
      const response = await page.request.post("/api/progress", {
        data: { contentItemSlug: slug, action: "complete" },
      });
      expect(response.ok()).toBe(true);
    }

    await page.goto("/dashboard");
    await expect(page.getByText(/path complete/i)).toBeVisible();
    await expect(page.getByRole("link", { name: /^resume:/i })).toHaveCount(0);
    await expect(page.getByRole("link", { name: /^start:/i })).toHaveCount(0);
  });
});
