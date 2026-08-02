import { describe, expect, it } from "vitest";
import { computeContentHash } from "../hash";

describe("computeContentHash", () => {
  it("is stable across differing key order", () => {
    const a = computeContentHash({ title: "Hello", slug: "hello", topics: ["a", "b"] });
    const b = computeContentHash({ topics: ["a", "b"], slug: "hello", title: "Hello" });
    expect(a).toBe(b);
  });

  it("is stable across differing key order in nested objects", () => {
    const a = computeContentHash({ video: { url: "u", captionsUrl: "c" } });
    const b = computeContentHash({ video: { captionsUrl: "c", url: "u" } });
    expect(a).toBe(b);
  });

  it("changes when the body changes", () => {
    const a = computeContentHash({ slug: "hello", body: "Version one." });
    const b = computeContentHash({ slug: "hello", body: "Version two." });
    expect(a).not.toBe(b);
  });

  it("changes when array order changes (order is significant for arrays)", () => {
    const a = computeContentHash({ topics: ["a", "b"] });
    const b = computeContentHash({ topics: ["b", "a"] });
    expect(a).not.toBe(b);
  });

  it("does not change when only lastReviewedAt changes", () => {
    const a = computeContentHash({
      slug: "hello",
      body: "Same body.",
      lastReviewedAt: "2026-01-01",
    });
    const b = computeContentHash({
      slug: "hello",
      body: "Same body.",
      lastReviewedAt: "2026-06-01",
    });
    expect(a).toBe(b);
  });

  it("does not change when only changeNote changes", () => {
    const a = computeContentHash({ slug: "hello", body: "Same body.", changeNote: "first note" });
    const b = computeContentHash({ slug: "hello", body: "Same body.", changeNote: "second note" });
    expect(a).toBe(b);
  });

  it("produces a 64-character hex sha256 digest", () => {
    const hash = computeContentHash({ slug: "hello" });
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });
});
