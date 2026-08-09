import type { Locator, Page } from "@playwright/test";

/**
 * Clicks a star in `<StarRatingInput>` (task 38-40 support helper, not in
 * the plan's numbered task list — added while writing the e2e specs).
 *
 * The underlying `<input type="radio">` is visually hidden via Tailwind's
 * `sr-only` utility (`clip-path: inset(50%)`), nested inside its `<label>`
 * so the hidden hit-target stays within that label's own box (see the
 * comment in `src/components/ratings/star-rating-input.tsx`). Chromium
 * does not treat the fully clip-path-masked input as hit-testable at its
 * own coordinates, so Playwright's `getByRole("radio", { name }).click()`
 * times out waiting for the input itself to become clickable — exactly the
 * class of bug real-browser e2e coverage exists to catch (a `jsdom`-based
 * component test can't see it, since `jsdom` never computes real layout).
 * A real mouse user clicks the visible label/glyph, which the browser
 * then forwards to the associated input per native `<label>` semantics —
 * this helper does the same thing Playwright's automation should, by
 * clicking the label directly rather than the input it wraps.
 */
export async function clickStar(
  scope: Page | Locator,
  starLabel: `${number} star` | `${number} stars`,
): Promise<void> {
  await scope.locator("label").filter({ hasText: starLabel }).click();
}
