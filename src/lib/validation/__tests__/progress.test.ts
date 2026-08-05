import { describe, expect, it } from "vitest";
import { progressActionSchema } from "../progress";

describe("progressActionSchema", () => {
  it("accepts a valid payload for each action", () => {
    for (const action of ["view", "complete", "reopen"] as const) {
      const result = progressActionSchema.safeParse({
        contentItemSlug: "what-is-artificial-intelligence",
        action,
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual({
          contentItemSlug: "what-is-artificial-intelligence",
          action,
        });
      }
    }
  });

  it("rejects an unknown action", () => {
    const result = progressActionSchema.safeParse({
      contentItemSlug: "what-is-artificial-intelligence",
      action: "delete",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a missing contentItemSlug", () => {
    const result = progressActionSchema.safeParse({ action: "view" });
    expect(result.success).toBe(false);
  });

  it("rejects an empty contentItemSlug", () => {
    const result = progressActionSchema.safeParse({ contentItemSlug: "   ", action: "view" });
    expect(result.success).toBe(false);
  });

  it("rejects a contentItemSlug over 200 characters", () => {
    const result = progressActionSchema.safeParse({
      contentItemSlug: `a${"a".repeat(200)}`,
      action: "view",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a slug containing path traversal", () => {
    const result = progressActionSchema.safeParse({
      contentItemSlug: "../../etc/passwd",
      action: "view",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a slug containing uppercase characters", () => {
    const result = progressActionSchema.safeParse({
      contentItemSlug: "What-Is-Artificial-Intelligence",
      action: "view",
    });
    expect(result.success).toBe(false);
  });

  it("trims surrounding whitespace from a valid slug", () => {
    const result = progressActionSchema.safeParse({
      contentItemSlug: "  what-is-artificial-intelligence  ",
      action: "view",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.contentItemSlug).toBe("what-is-artificial-intelligence");
    }
  });
});
