// @vitest-environment node
import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "../password";

// NFR-SEC-001: argon2id, salted, never plaintext. Node environment because
// @node-rs/argon2 is a native module that jsdom doesn't need to be involved
// with.
describe("password hashing", () => {
  it("produces a hash that is not the plaintext password", async () => {
    const password = "correct-horse-battery-staple";
    const hash = await hashPassword(password);
    expect(hash).not.toBe(password);
    expect(hash).not.toContain(password);
  });

  it("produces an argon2id-prefixed hash", async () => {
    const hash = await hashPassword("correct-horse-battery-staple");
    expect(hash.startsWith("$argon2id$")).toBe(true);
  });

  it("produces different hashes for the same password (salted)", async () => {
    const password = "correct-horse-battery-staple";
    const [hashA, hashB] = await Promise.all([hashPassword(password), hashPassword(password)]);
    expect(hashA).not.toBe(hashB);
  });

  it("round-trips: verify succeeds against the matching hash", async () => {
    const password = "correct-horse-battery-staple";
    const hash = await hashPassword(password);
    await expect(verifyPassword(hash, password)).resolves.toBe(true);
  });

  it("verify rejects an incorrect password", async () => {
    const hash = await hashPassword("correct-horse-battery-staple");
    await expect(verifyPassword(hash, "wrong-password-entirely")).resolves.toBe(false);
  });
});
