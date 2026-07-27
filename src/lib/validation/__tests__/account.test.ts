import { describe, expect, it } from "vitest";
import {
  deleteAccountSchema,
  deleteConfirmationMatches,
  forgotPasswordSchema,
  profileSchema,
  resetPasswordSchema,
  signInSchema,
  signUpSchema,
} from "../account";

describe("signUpSchema", () => {
  const base = {
    name: "Ada Lovelace",
    email: "ADA@Example.com",
    password: "correct-horse-battery",
    minimumAgeAcknowledged: true as const,
  };

  it("accepts a valid sign-up payload", () => {
    const result = signUpSchema.safeParse(base);
    expect(result.success).toBe(true);
  });

  it("normalizes email to lowercase", () => {
    const result = signUpSchema.safeParse(base);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe("ada@example.com");
    }
  });

  it("trims and length-caps the name, stripping control characters", () => {
    const withControlChars = `  Ada${String.fromCodePoint(7)}Lovelace  `;
    const result = signUpSchema.safeParse({ ...base, name: withControlChars });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe("AdaLovelace");
    }
  });

  it("rejects a name longer than 100 characters", () => {
    const result = signUpSchema.safeParse({ ...base, name: "a".repeat(101) });
    expect(result.success).toBe(false);
  });

  it("rejects an empty name", () => {
    const result = signUpSchema.safeParse({ ...base, name: "   " });
    expect(result.success).toBe(false);
  });

  it("rejects a password shorter than 12 characters", () => {
    const result = signUpSchema.safeParse({ ...base, password: "short1234" });
    expect(result.success).toBe(false);
  });

  it("rejects a password longer than 128 characters", () => {
    const result = signUpSchema.safeParse({ ...base, password: "a".repeat(129) });
    expect(result.success).toBe(false);
  });

  it("accepts a password at the 12-character lower bound", () => {
    const result = signUpSchema.safeParse({ ...base, password: "a".repeat(12) });
    expect(result.success).toBe(true);
  });

  it("accepts a password at the 128-character upper bound", () => {
    const result = signUpSchema.safeParse({ ...base, password: "a".repeat(128) });
    expect(result.success).toBe(true);
  });

  it("rejects an invalid email", () => {
    const result = signUpSchema.safeParse({ ...base, email: "not-an-email" });
    expect(result.success).toBe(false);
  });

  it("requires minimumAgeAcknowledged to be true", () => {
    const result = signUpSchema.safeParse({ ...base, minimumAgeAcknowledged: false });
    expect(result.success).toBe(false);
  });

  it("rejects a missing minimumAgeAcknowledged", () => {
    const { minimumAgeAcknowledged: _omit, ...withoutAck } = base;
    const result = signUpSchema.safeParse(withoutAck);
    expect(result.success).toBe(false);
  });
});

describe("signInSchema", () => {
  it("accepts a valid sign-in payload", () => {
    const result = signInSchema.safeParse({ email: "a@example.com", password: "anything" });
    expect(result.success).toBe(true);
  });

  it("rejects an empty password", () => {
    const result = signInSchema.safeParse({ email: "a@example.com", password: "" });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid email", () => {
    const result = signInSchema.safeParse({ email: "nope", password: "anything" });
    expect(result.success).toBe(false);
  });
});

describe("forgotPasswordSchema", () => {
  it("normalizes email to lowercase and trims", () => {
    const result = forgotPasswordSchema.safeParse({ email: "  ADA@Example.com  " });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe("ada@example.com");
    }
  });
});

describe("resetPasswordSchema", () => {
  it("rejects a missing token", () => {
    const result = resetPasswordSchema.safeParse({ token: "", password: "a".repeat(12) });
    expect(result.success).toBe(false);
  });

  it("rejects a short password", () => {
    const result = resetPasswordSchema.safeParse({ token: "tok", password: "short" });
    expect(result.success).toBe(false);
  });

  it("accepts a valid token and password", () => {
    const result = resetPasswordSchema.safeParse({ token: "tok", password: "a".repeat(12) });
    expect(result.success).toBe(true);
  });
});

describe("profileSchema", () => {
  it("accepts every documented role archetype and level", () => {
    const roles = [
      "TECHNICAL_BUILDER",
      "ENGINEERING_LEADER",
      "EXECUTIVE_NON_TECHNICAL",
      "INVESTOR",
      "NOT_SURE_YET",
    ];
    const levels = ["ZERO_KNOWLEDGE", "INTERMEDIATE", "ADVANCED"];
    for (const roleArchetype of roles) {
      for (const level of levels) {
        expect(profileSchema.safeParse({ roleArchetype, level }).success).toBe(true);
      }
    }
  });

  it("rejects an unknown role archetype", () => {
    const result = profileSchema.safeParse({ roleArchetype: "WIZARD", level: "ADVANCED" });
    expect(result.success).toBe(false);
  });

  it("rejects an unknown level", () => {
    const result = profileSchema.safeParse({
      roleArchetype: "TECHNICAL_BUILDER",
      level: "EXPERT",
    });
    expect(result.success).toBe(false);
  });
});

describe("deleteAccountSchema / deleteConfirmationMatches", () => {
  it("matches when the typed confirmation equals the account email exactly", () => {
    const input = deleteAccountSchema.parse({
      confirmEmail: "ada@example.com",
      accountEmail: "ada@example.com",
    });
    expect(deleteConfirmationMatches(input)).toBe(true);
  });

  it("does not match on case difference", () => {
    const input = deleteAccountSchema.parse({
      confirmEmail: "ADA@example.com",
      accountEmail: "ada@example.com",
    });
    expect(deleteConfirmationMatches(input)).toBe(false);
  });

  it("does not match on trailing whitespace", () => {
    const input = deleteAccountSchema.parse({
      confirmEmail: "ada@example.com ",
      accountEmail: "ada@example.com",
    });
    expect(deleteConfirmationMatches(input)).toBe(false);
  });

  it("does not match an empty confirmation", () => {
    const input = deleteAccountSchema.parse({
      confirmEmail: "",
      accountEmail: "ada@example.com",
    });
    expect(deleteConfirmationMatches(input)).toBe(false);
  });
});
