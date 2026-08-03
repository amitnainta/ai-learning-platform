import { describe, expect, it } from "vitest";
import { PROGRESS_STATUS_LABELS, displayStatusFor, type DisplayProgressStatus } from "../status";

describe("displayStatusFor", () => {
  it("maps an absent row to NOT_STARTED (decision #2)", () => {
    expect(displayStatusFor(undefined)).toBe("NOT_STARTED");
    expect(displayStatusFor(null)).toBe("NOT_STARTED");
  });

  it("passes through a persisted IN_PROGRESS row unchanged", () => {
    expect(displayStatusFor({ status: "IN_PROGRESS" })).toBe("IN_PROGRESS");
  });

  it("passes through a persisted COMPLETE row unchanged", () => {
    expect(displayStatusFor({ status: "COMPLETE" })).toBe("COMPLETE");
  });
});

describe("PROGRESS_STATUS_LABELS", () => {
  it("has a label for every DisplayProgressStatus", () => {
    const statuses: DisplayProgressStatus[] = ["NOT_STARTED", "IN_PROGRESS", "COMPLETE"];
    for (const status of statuses) {
      expect(PROGRESS_STATUS_LABELS[status]).toBeTypeOf("string");
      expect(PROGRESS_STATUS_LABELS[status].length).toBeGreaterThan(0);
    }
  });

  it("uses the exact FR-PROG-001 vocabulary", () => {
    expect(PROGRESS_STATUS_LABELS.NOT_STARTED).toBe("Not started");
    expect(PROGRESS_STATUS_LABELS.IN_PROGRESS).toBe("In progress");
    expect(PROGRESS_STATUS_LABELS.COMPLETE).toBe("Complete");
  });
});
