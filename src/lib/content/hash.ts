import { createHash } from "node:crypto";

/**
 * `computeContentHash(payload)` — stable, key-order-independent
 * serialization of an item's importable fields hashed with `node:crypto`
 * (task 9). Deliberately excludes `lastReviewedAt` and `changeNote` (at any
 * nesting level) so that re-reviewing an unchanged item does not create a
 * spurious version (decision #8) — the hash function does the excluding
 * itself, so a caller can pass the full loaded item without pre-stripping
 * those fields.
 */

const EXCLUDED_KEYS = new Set(["lastReviewedAt", "changeNote"]);

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }

  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([key]) => !EXCLUDED_KEYS.has(key))
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));

  return `{${entries.map(([key, val]) => `${JSON.stringify(key)}:${stableStringify(val)}`).join(",")}}`;
}

export function computeContentHash(payload: Record<string, unknown>): string {
  return createHash("sha256").update(stableStringify(payload)).digest("hex");
}
