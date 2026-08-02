import { describe, expect, it } from "vitest";
import { isSafeRedirectPath, resolveSafeRedirect } from "../safe-redirect";

// REVIEW.md C1: open redirect via the sign-in `next` query param. A naive
// `next.startsWith("/")` check admits protocol-relative URLs.
describe("isSafeRedirectPath", () => {
  it("accepts a genuine same-origin relative path", () => {
    expect(isSafeRedirectPath("/dashboard")).toBe(true);
    expect(isSafeRedirectPath("/account?tab=profile")).toBe(true);
    expect(isSafeRedirectPath("/onboarding#step-2")).toBe(true);
  });

  it("rejects null/undefined/empty", () => {
    expect(isSafeRedirectPath(null)).toBe(false);
    expect(isSafeRedirectPath(undefined)).toBe(false);
    expect(isSafeRedirectPath("")).toBe(false);
  });

  it("rejects a protocol-relative URL", () => {
    expect(isSafeRedirectPath("//evil.example")).toBe(false);
    expect(isSafeRedirectPath("//evil.example/phish")).toBe(false);
  });

  it("rejects the backslash variant some browsers normalise to //", () => {
    expect(isSafeRedirectPath("/\\evil.example")).toBe(false);
  });

  it("rejects a value that resolves to // once tabs/newlines are stripped", () => {
    expect(isSafeRedirectPath("/\t/evil.example")).toBe(false);
    expect(isSafeRedirectPath("/\n/evil.example")).toBe(false);
  });

  it("rejects an absolute URL with a scheme", () => {
    expect(isSafeRedirectPath("https://evil.example")).toBe(false);
    expect(isSafeRedirectPath("javascript:alert(1)")).toBe(false);
  });

  it("rejects a path not starting with a single slash", () => {
    expect(isSafeRedirectPath("dashboard")).toBe(false);
    expect(isSafeRedirectPath("evil.example")).toBe(false);
  });
});

describe("resolveSafeRedirect", () => {
  it("returns the safe path unchanged", () => {
    expect(resolveSafeRedirect("/account")).toBe("/account");
  });

  it("falls back to /dashboard for an open-redirect attempt", () => {
    expect(resolveSafeRedirect("//evil.example")).toBe("/dashboard");
    expect(resolveSafeRedirect("https://evil.example")).toBe("/dashboard");
    expect(resolveSafeRedirect(null)).toBe("/dashboard");
  });

  it("honours a custom fallback", () => {
    expect(resolveSafeRedirect("//evil.example", "/home")).toBe("/home");
  });
});
