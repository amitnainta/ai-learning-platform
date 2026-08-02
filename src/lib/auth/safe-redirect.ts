/**
 * Guards against open-redirect attacks via a client-supplied `next`/`redirect`
 * query parameter (REVIEW.md C1). A naive `next.startsWith("/")` check admits
 * protocol-relative URLs: `//evil.example` starts with a single `/`, but a
 * browser resolves it against the current origin as `https://evil.example` —
 * an off-site navigation immediately after a successful credential submission.
 *
 * This only ever needs to accept a genuine same-origin relative path, so the
 * rule is deliberately narrow rather than an attempted allow/deny list of
 * schemes:
 *   - ASCII tab/newline/carriage-return characters are stripped first,
 *     mirroring the WHATWG URL spec's own parsing behaviour — some browsers
 *     strip these during URL resolution, so a value like `"/\t/evil.example"`
 *     must be judged on what it resolves to (`"//evil.example"`), not on its
 *     raw, pre-strip form.
 *   - must start with exactly one `/` (not `//`, not `/\`, which some
 *     browsers normalise to `//`)
 *   - must not contain a `:` before the first `/`, `?`, or `#` — rules out
 *     an embedded scheme (`javascript:`, `https:`, `data:`, ...); kept as
 *     defence in depth even though the `//`/`/\` checks above already
 *     eliminate the realistic bypasses, since a value starting with a single
 *     `/` cannot itself begin a URL scheme.
 *
 * Anything that fails the check should fall back to a known-safe default
 * (e.g. `/dashboard`), never to the rejected value.
 */
export function isSafeRedirectPath(next: string | null | undefined): next is string {
  if (!next) {
    return false;
  }

  // Mirror WHATWG URL parsing: strip ASCII tab/newline/CR before judging
  // the value, since that's what a browser will ultimately navigate to.
  const normalized = next.replace(/[\t\n\r]/g, "");

  if (!normalized) {
    return false;
  }

  // Reject anything that isn't a single-slash-prefixed path.
  if (!normalized.startsWith("/")) {
    return false;
  }

  // Reject protocol-relative URLs (`//evil.example`) and the backslash
  // variant some browsers normalise to `//` (`/\evil.example`).
  if (normalized.startsWith("//") || normalized.startsWith("/\\")) {
    return false;
  }

  // Reject an embedded scheme (`javascript:`, `https:`, ...) anywhere
  // before the path/query/fragment actually starts.
  const schemeBoundary = normalized.search(/[/?#]/);
  const prefix = schemeBoundary === -1 ? normalized : normalized.slice(0, schemeBoundary);
  if (prefix.includes(":")) {
    return false;
  }

  return true;
}

/**
 * Returns `next` when it is a safe same-origin relative path, otherwise
 * `fallback`.
 */
export function resolveSafeRedirect(
  next: string | null | undefined,
  fallback: string = "/dashboard",
): string {
  return isSafeRedirectPath(next) ? next : fallback;
}
