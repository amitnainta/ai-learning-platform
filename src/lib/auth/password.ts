import { hash, verify } from "@node-rs/argon2";

/**
 * Password hashing (NFR-SEC-001, decision #5 in
 * factory/work/user-accounts-auth/PLAN.md). argon2id via the native
 * `@node-rs/argon2` binding, with OWASP-recommended parameters that land
 * around 50-100ms per hash — well inside the NFR-PERF-004 500ms p95 budget.
 *
 * Wired into Better Auth as the custom `emailAndPassword.password.hash` /
 * `.verify` functions (see src/lib/auth/options.ts) so credential accounts
 * use argon2id instead of Better Auth's scrypt default.
 *
 * Never log the plaintext password or the resulting hash from this module
 * or any caller.
 */

// OWASP password-hashing cheat sheet recommendation for argon2id.
const ARGON2_MEMORY_COST_KIB = 19456;
const ARGON2_TIME_COST = 2;
const ARGON2_PARALLELISM = 1;
// @node-rs/argon2's `Algorithm` is an ambient `const enum`, which can't be
// imported by value under `isolatedModules` (each file is transpiled in
// isolation, so the compiler can't safely inline it). `2` is
// `Algorithm.Argon2id` per the package's own type declarations.
const ARGON2ID = 2;

export async function hashPassword(password: string): Promise<string> {
  return hash(password, {
    memoryCost: ARGON2_MEMORY_COST_KIB,
    timeCost: ARGON2_TIME_COST,
    parallelism: ARGON2_PARALLELISM,
    algorithm: ARGON2ID,
  });
}

export async function verifyPassword(hashedPassword: string, password: string): Promise<boolean> {
  return verify(hashedPassword, password);
}
