import { describe, expect, it } from "vitest";
import {
  FEEDBACK_MAX_LENGTH,
  FLAG_NOTE_MAX_LENGTH,
  ratingFlagSchema,
  ratingRemovalSchema,
  ratingSubmissionSchema,
} from "../rating";

const BASE_TARGET = { targetType: "course" as const, targetSlug: "ai-foundations" };

describe("ratingSubmissionSchema — stars", () => {
  it("rejects 0", () => {
    expect(ratingSubmissionSchema.safeParse({ ...BASE_TARGET, stars: 0 }).success).toBe(false);
  });

  it("rejects 6", () => {
    expect(ratingSubmissionSchema.safeParse({ ...BASE_TARGET, stars: 6 }).success).toBe(false);
  });

  it("rejects 3.5 (not a whole number)", () => {
    expect(ratingSubmissionSchema.safeParse({ ...BASE_TARGET, stars: 3.5 }).success).toBe(false);
  });

  it('rejects the string "4"', () => {
    expect(ratingSubmissionSchema.safeParse({ ...BASE_TARGET, stars: "4" }).success).toBe(false);
  });

  it("accepts a valid submission", () => {
    const result = ratingSubmissionSchema.safeParse({
      ...BASE_TARGET,
      stars: 4,
      feedback: "Great course!",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.stars).toBe(4);
      expect(result.data.feedback).toBe("Great course!");
    }
  });
});

describe("ratingSubmissionSchema — feedback", () => {
  it("rejects feedback longer than 2000 characters after normalization", () => {
    const result = ratingSubmissionSchema.safeParse({
      ...BASE_TARGET,
      stars: 5,
      feedback: "a".repeat(FEEDBACK_MAX_LENGTH + 1),
    });
    expect(result.success).toBe(false);
  });

  it("accepts feedback at exactly the cap", () => {
    const result = ratingSubmissionSchema.safeParse({
      ...BASE_TARGET,
      stars: 5,
      feedback: "a".repeat(FEEDBACK_MAX_LENGTH),
    });
    expect(result.success).toBe(true);
  });

  it("parses a script payload through unchanged as literal text (escaping is a render-time concern)", () => {
    const payload = '<script>alert("xss")</script>';
    const result = ratingSubmissionSchema.safeParse({
      ...BASE_TARGET,
      stars: 5,
      feedback: payload,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.feedback).toBe(payload);
    }
  });

  it("whitespace-only feedback becomes null", () => {
    const result = ratingSubmissionSchema.safeParse({ ...BASE_TARGET, stars: 5, feedback: "   " });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.feedback).toBeNull();
    }
  });

  it("omitted feedback becomes null", () => {
    const result = ratingSubmissionSchema.safeParse({ ...BASE_TARGET, stars: 5 });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.feedback).toBeNull();
    }
  });
});

describe("ratingSubmissionSchema — target", () => {
  it("rejects an unknown targetType", () => {
    const result = ratingSubmissionSchema.safeParse({
      targetType: "lesson",
      targetSlug: "foo",
      stars: 5,
    });
    expect(result.success).toBe(false);
  });

  it("rejects a malformed slug", () => {
    const result = ratingSubmissionSchema.safeParse({
      targetType: "course",
      targetSlug: "Not A Valid Slug!",
      stars: 5,
    });
    expect(result.success).toBe(false);
  });

  it("accepts a valid path target", () => {
    const result = ratingSubmissionSchema.safeParse({
      targetType: "path",
      targetSlug: "technical-builder-zero-knowledge",
      stars: 3,
    });
    expect(result.success).toBe(true);
  });
});

describe("ratingRemovalSchema", () => {
  it("accepts a target with no stars/feedback", () => {
    expect(ratingRemovalSchema.safeParse(BASE_TARGET).success).toBe(true);
  });
});

describe("ratingFlagSchema", () => {
  const BASE_FLAG = { ratingId: "cabcdefghij1234567890", reason: "SPAM" as const };

  it("accepts a valid flag with no note", () => {
    const result = ratingFlagSchema.safeParse(BASE_FLAG);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.note).toBeNull();
    }
  });

  it("rejects an unknown flag reason", () => {
    const result = ratingFlagSchema.safeParse({ ...BASE_FLAG, reason: "MADE_ME_SAD" });
    expect(result.success).toBe(false);
  });

  it("rejects a note over 500 characters", () => {
    const result = ratingFlagSchema.safeParse({
      ...BASE_FLAG,
      note: "a".repeat(FLAG_NOTE_MAX_LENGTH + 1),
    });
    expect(result.success).toBe(false);
  });

  it("accepts a note at exactly the cap", () => {
    const result = ratingFlagSchema.safeParse({
      ...BASE_FLAG,
      note: "a".repeat(FLAG_NOTE_MAX_LENGTH),
    });
    expect(result.success).toBe(true);
  });

  it("accepts every documented reason", () => {
    for (const reason of ["INAPPROPRIATE", "SPAM", "OUTDATED_OR_INCORRECT", "OTHER"]) {
      expect(ratingFlagSchema.safeParse({ ...BASE_FLAG, reason }).success).toBe(true);
    }
  });
});
