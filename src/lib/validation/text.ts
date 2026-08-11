/**
 * Shared, security-relevant text-normalization helpers (task 3,
 * NFR-SEC-007). `stripControlCharacters` moved here verbatim from
 * `src/lib/validation/account.ts` (decision #7,
 * factory/work/ratings-and-feedback/PLAN.md) so every field that needs it —
 * a display name (no newlines) or multi-paragraph feedback (newlines
 * preserved) — shares one tested implementation instead of two copies.
 */

// Strip ASCII control characters (e.g. a pasted null byte or terminal
// escape sequence) from user-entered text before it's stored or rendered.
// Implemented as a code-point filter (not a regex control-character
// class) so this source file contains no raw control bytes.
const MAX_CONTROL_CODE_POINT = 31;
const DELETE_CODE_POINT = 127;
const LINE_FEED_CODE_POINT = 10;
const CARRIAGE_RETURN_CODE_POINT = 13;

/**
 * Strips ASCII control characters. By default (`allowNewlines: false`,
 * matching the original `account.ts` behaviour bit-for-bit) every code
 * point <= 31 is removed, including newline (10) and carriage return (13) —
 * correct for a single-line field like a display name. With
 * `allowNewlines: true`, code points 10 and 13 are spared so multi-paragraph
 * text (e.g. rating feedback) survives.
 */
export function stripControlCharacters(
  value: string,
  options?: { allowNewlines?: boolean },
): string {
  const allowNewlines = options?.allowNewlines ?? false;
  return Array.from(value)
    .filter((char) => {
      const codePoint = char.codePointAt(0) ?? 0;
      if (codePoint === DELETE_CODE_POINT) {
        return false;
      }
      if (codePoint > MAX_CONTROL_CODE_POINT) {
        return true;
      }
      if (
        allowNewlines &&
        (codePoint === LINE_FEED_CODE_POINT || codePoint === CARRIAGE_RETURN_CODE_POINT)
      ) {
        return true;
      }
      return false;
    })
    .join("");
}

// Three-or-more consecutive newlines collapse to two (one blank line)
// rather than being removed entirely, so intentional paragraph breaks in
// feedback survive while accidental walls of blank lines don't.
const THREE_OR_MORE_NEWLINES = /\n{3,}/g;

/**
 * Normalizes free-text, multi-paragraph input (decision #7): strips control
 * characters while preserving newlines, converts CRLF and lone CR to LF,
 * trims, and collapses runs of three-or-more newlines to two. Used by
 * `src/lib/validation/rating.ts` for feedback and flag notes — never by
 * `nameSchema`, which keeps its newline-stripping behaviour unchanged.
 */
export function normalizeMultilineText(value: string): string {
  const crlfNormalized = value.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const stripped = stripControlCharacters(crlfNormalized, { allowNewlines: true });
  const collapsed = stripped.replace(THREE_OR_MORE_NEWLINES, "\n\n");
  return collapsed.trim();
}
