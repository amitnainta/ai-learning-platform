import { expect, test } from "@playwright/test";
import { findTestUserByEmail, uniqueTestEmail } from "./helpers/db";
import { registerAndOnboard } from "./helpers/register";

const PASSWORD = "correct-horse-battery-staple";

// FR-PATH-009: a signed-in user can switch role/level from the dashboard,
// the change persists on their profile, and an item shared between the old
// and new path is the exact same row in both (the structural half of the
// "retain progress on overlapping items" guarantee — the observable
// progress-retention behavior itself ships with the FR-PROG work item).
test.describe("content: path switch", () => {
  test("switching path from the dashboard persists the profile and a shared item appears in both paths", async ({
    page,
  }) => {
    const email = uniqueTestEmail("path-switch");
    // registerAndOnboard signs up via page.request, which sets a real
    // session cookie in this browser context (Better Auth issues it on the
    // sign-up response) — the user is already authenticated afterwards, so
    // there's no separate sign-in step to drive here.
    await registerAndOnboard(
      page.request,
      { email, password: PASSWORD, name: "Path Switch User" },
      { roleArchetype: "TECHNICAL_BUILDER", level: "ZERO_KNOWLEDGE" },
    );

    await page.goto("/dashboard");
    await expect(page.getByRole("heading", { name: /welcome/i })).toBeVisible();

    // The shared item is reachable from the old (Technical Builder, Zero
    // Knowledge) path.
    await page.goto("/paths/technical-builder/zero-knowledge");
    await expect(
      page.getByRole("link", { name: /what is artificial intelligence/i }),
    ).toBeVisible();

    // Switch to Executive / Non-Technical, Zero Knowledge from the dashboard.
    await page.goto("/dashboard");
    await page.getByLabel("Role").selectOption("EXECUTIVE_NON_TECHNICAL");
    await page.getByLabel("Level").selectOption("ZERO_KNOWLEDGE");
    await page.getByRole("button", { name: /switch path/i }).click();

    await expect(page).toHaveURL("/paths/executive-non-technical/zero-knowledge");
    await expect(
      page.getByRole("heading", { name: /executive \/ non-technical — zero knowledge/i }),
    ).toBeVisible();

    // The shared item appears in the new path too, and both link to the
    // exact same lesson URL — proof it's a single row, not a duplicate.
    const sharedItemLink = page.getByRole("link", { name: /what is artificial intelligence/i });
    await expect(sharedItemLink).toBeVisible();
    await expect(sharedItemLink).toHaveAttribute(
      "href",
      "/lessons/what-is-artificial-intelligence",
    );

    // The profile change persisted on the User row.
    const user = await findTestUserByEmail(email);
    expect(user?.roleArchetype).toBe("EXECUTIVE_NON_TECHNICAL");
    expect(user?.level).toBe("ZERO_KNOWLEDGE");
  });
});
