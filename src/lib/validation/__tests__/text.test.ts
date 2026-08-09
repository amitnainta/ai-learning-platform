import { describe, expect, it } from "vitest";
import { normalizeMultilineText, stripControlCharacters } from "../text";

describe("stripControlCharacters", () => {
  it("removes a null byte", () => {
    expect(stripControlCharacters(`a${String.fromCodePoint(0)}b`)).toBe("ab");
  });

  it("removes an escape sequence", () => {
    expect(stripControlCharacters(`a${String.fromCodePoint(27)}b`)).toBe("ab");
  });

  it("by default, removes a newline", () => {
    expect(stripControlCharacters("a\nb")).toBe("ab");
  });

  it("by default, removes a carriage return", () => {
    expect(stripControlCharacters("a\rb")).toBe("ab");
  });

  it("removes the DEL character", () => {
    expect(stripControlCharacters(`a${String.fromCodePoint(127)}b`)).toBe("ab");
  });

  it("with allowNewlines, keeps LF and CR while still removing other control characters", () => {
    const input = `line one\nline two\r${String.fromCodePoint(0)}line three`;
    expect(stripControlCharacters(input, { allowNewlines: true })).toBe(
      "line one\nline two\rline three",
    );
  });
});

describe("normalizeMultilineText", () => {
  it("converts CRLF to LF", () => {
    expect(normalizeMultilineText("line one\r\nline two")).toBe("line one\nline two");
  });

  it("converts a lone CR to LF", () => {
    expect(normalizeMultilineText("line one\rline two")).toBe("line one\nline two");
  });

  it("collapses four blank lines to one blank line", () => {
    expect(normalizeMultilineText("para one\n\n\n\npara two")).toBe("para one\n\npara two");
  });

  it("trims leading and trailing whitespace", () => {
    expect(normalizeMultilineText("  \n hello \n  ")).toBe("hello");
  });

  it("returns an empty string for whitespace-only input", () => {
    expect(normalizeMultilineText("   \n\n   ")).toBe("");
  });

  it("strips control characters but preserves newlines", () => {
    expect(normalizeMultilineText(`a${String.fromCodePoint(0)}b\nc`)).toBe("ab\nc");
  });
});
