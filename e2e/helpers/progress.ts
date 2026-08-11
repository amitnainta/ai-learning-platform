import type { APIRequestContext } from "@playwright/test";

/**
 * Test-only setup helper (task 37, factory/work/ratings-and-feedback/PLAN.md):
 * completes content items directly through `POST /api/progress` so rating
 * specs can reach an eligible state without re-driving the completion UI —
 * the same rationale `e2e/helpers/register.ts`'s `registerAndOnboard` uses.
 * The completion UI itself is already exercised by progress-complete.spec.ts.
 */

/**
 * The five seeded item slugs of the Technical Builder / Zero Knowledge path
 * (content/paths/technical-builder-zero-knowledge.yaml), in path order —
 * course 1 (ai-foundations-for-builders): what-is-artificial-intelligence,
 * google-ai-crash-course, elements-of-ai-course; course 2
 * (getting-started-with-machine-learning): how-machine-learning-works,
 * visual-intro-to-machine-learning. Stated once here so the "completed
 * path" fixture used by rating-path.spec.ts and progress-resume.spec.ts
 * doesn't drift out of two copies.
 */
export const TECHNICAL_BUILDER_ZERO_KNOWLEDGE_ITEMS = [
  "what-is-artificial-intelligence",
  "google-ai-crash-course",
  "elements-of-ai-course",
  "how-machine-learning-works",
  "visual-intro-to-machine-learning",
];

export async function completeContentItems(
  request: APIRequestContext,
  slugs: string[],
): Promise<void> {
  for (const slug of slugs) {
    const response = await request.post("/api/progress", {
      data: { contentItemSlug: slug, action: "complete" },
    });
    if (!response.ok()) {
      throw new Error(
        `Failed to complete "${slug}": ${response.status()} ${await response.text()}`,
      );
    }
  }
}
