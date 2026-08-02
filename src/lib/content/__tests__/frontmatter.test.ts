import { describe, expect, it } from "vitest";
import { parseFrontmatter } from "../frontmatter";

describe("parseFrontmatter", () => {
  it("parses an LF file", () => {
    const source = "---\ntitle: Hello\nslug: hello\n---\nBody text here.\n";
    const result = parseFrontmatter(source, "test.md");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.value.data).toEqual({ title: "Hello", slug: "hello" });
      expect(result.value.body).toBe("Body text here.\n");
    }
  });

  it("parses a CRLF file (Windows line endings)", () => {
    const source = "---\r\ntitle: Hello\r\nslug: hello\r\n---\r\nBody text here.\r\n";
    const result = parseFrontmatter(source, "test.md");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.value.data).toEqual({ title: "Hello", slug: "hello" });
      // Body content is byte-identical to what followed the closing
      // delimiter — parseFrontmatter must never mutate it.
      expect(result.value.body).toBe("Body text here.\r\n");
    }
  });

  it("leaves multi-paragraph body content byte-identical", () => {
    const body = "First paragraph.\n\nSecond paragraph with *emphasis*.\n\n- a list\n- item\n";
    const source = `---\nslug: test\n---\n${body}`;
    const result = parseFrontmatter(source, "test.md");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.value.body).toBe(body);
    }
  });

  it("errors descriptively on a missing frontmatter block", () => {
    const result = parseFrontmatter("Just some plain text, no frontmatter.", "no-frontmatter.md");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("no-frontmatter.md");
      expect(result.error.toLowerCase()).toContain("frontmatter");
    }
  });

  it("errors descriptively on an unclosed frontmatter block", () => {
    const result = parseFrontmatter("---\ntitle: Hello\nBody with no closing delimiter", "bad.md");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("bad.md");
    }
  });

  it("errors descriptively on an empty frontmatter block", () => {
    const result = parseFrontmatter("---\n\n---\nBody.", "empty.md");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("empty.md");
      expect(result.error.toLowerCase()).toContain("empty");
    }
  });

  it("errors descriptively on malformed YAML", () => {
    const result = parseFrontmatter("---\ntitle: [unclosed\n---\nBody.", "malformed.md");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("malformed.md");
    }
  });

  it("errors when the frontmatter block is not a mapping", () => {
    const result = parseFrontmatter("---\n- a\n- b\n---\nBody.", "list.md");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("list.md");
    }
  });

  it("handles a file with an empty body after frontmatter", () => {
    const result = parseFrontmatter("---\nslug: test\n---\n", "empty-body.md");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.value.body).toBe("");
    }
  });
});
