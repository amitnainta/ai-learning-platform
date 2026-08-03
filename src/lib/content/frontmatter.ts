import { parse as parseYaml } from "yaml";

/**
 * Splits a `---`-delimited YAML frontmatter block from a Markdown body and
 * parses it with `yaml` (task 7). Handles CRLF (this is a Windows dev
 * machine) and reports a missing/malformed/empty frontmatter block as a
 * descriptive error including the file path, rather than throwing — the
 * loader (src/lib/content/loader.ts) aggregates these across the whole pack
 * instead of failing on the first bad file.
 */

export interface ParsedFrontmatter {
  data: Record<string, unknown>;
  body: string;
}

export type FrontmatterResult =
  { success: true; value: ParsedFrontmatter } | { success: false; error: string };

// Captures the YAML between the opening and closing `---` lines, and
// everything after the closing delimiter as the body — `\r?` throughout so
// both LF and CRLF line endings match identically. The body capture is
// intentionally *not* trimmed, so parseFrontmatter never mutates body
// content (frontmatter.test.ts asserts byte-identical output).
const FRONTMATTER_PATTERN = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/;

export function parseFrontmatter(source: string, filePath: string): FrontmatterResult {
  const match = FRONTMATTER_PATTERN.exec(source);
  if (!match) {
    return {
      success: false,
      error: `${filePath}: missing or malformed frontmatter block (expected a leading "---" delimited YAML block)`,
    };
  }

  const [, rawFrontmatter, body] = match;
  if (!rawFrontmatter || !rawFrontmatter.trim()) {
    return { success: false, error: `${filePath}: frontmatter block is empty` };
  }

  let data: unknown;
  try {
    data = parseYaml(rawFrontmatter);
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause);
    return { success: false, error: `${filePath}: could not parse frontmatter YAML — ${message}` };
  }

  if (data === null || typeof data !== "object" || Array.isArray(data)) {
    return {
      success: false,
      error: `${filePath}: frontmatter must be a YAML mapping (an object), not a list or scalar`,
    };
  }

  return { success: true, value: { data: data as Record<string, unknown>, body: body ?? "" } };
}
