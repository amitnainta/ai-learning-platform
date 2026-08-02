import { describe, expect, it } from "vitest";
import {
  contentItemFrontmatterSchema,
  glossaryFrontmatterSchema,
  videoBlockSchema,
} from "../content";

const baseOriginal = {
  slug: "what-is-ai",
  title: "What Is AI?",
  summary: "An introduction.",
  sourceType: "ORIGINAL" as const,
  roles: ["TECHNICAL_BUILDER"],
  level: "ZERO_KNOWLEDGE",
  format: "ARTICLE",
  estimatedMinutes: 5,
  topics: ["ai-fundamentals"],
  lastReviewedAt: "2026-06-01",
  body: "Some real body content about AI.",
};

const baseCurated = {
  slug: "curated-link",
  title: "A Curated Link",
  summary: "A link to somewhere else.",
  sourceType: "CURATED" as const,
  roles: ["TECHNICAL_BUILDER"],
  level: "ZERO_KNOWLEDGE",
  format: "ARTICLE",
  estimatedMinutes: 5,
  topics: ["ai-fundamentals"],
  lastReviewedAt: "2026-06-01",
  externalUrl: "https://example.com/article",
  sourcePublisher: "Example Publisher",
};

describe("contentItemFrontmatterSchema — ORIGINAL vs CURATED discriminated union", () => {
  it("accepts a valid ORIGINAL item", () => {
    const result = contentItemFrontmatterSchema.safeParse(baseOriginal);
    expect(result.success).toBe(true);
  });

  it("accepts a valid CURATED item", () => {
    const result = contentItemFrontmatterSchema.safeParse(baseCurated);
    expect(result.success).toBe(true);
  });

  it("rejects an ORIGINAL item with no body", () => {
    const { body: _body, ...withoutBody } = baseOriginal;
    const result = contentItemFrontmatterSchema.safeParse(withoutBody);
    expect(result.success).toBe(false);
  });

  it("rejects an ORIGINAL item that also carries externalUrl (wrong-shaped in the CURATED direction)", () => {
    const result = contentItemFrontmatterSchema.safeParse({
      ...baseOriginal,
      externalUrl: "https://example.com",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a CURATED item with no externalUrl", () => {
    const { externalUrl: _externalUrl, ...withoutUrl } = baseCurated;
    const result = contentItemFrontmatterSchema.safeParse(withoutUrl);
    expect(result.success).toBe(false);
  });

  it("rejects a CURATED item with no sourcePublisher", () => {
    const { sourcePublisher: _sourcePublisher, ...withoutPublisher } = baseCurated;
    const result = contentItemFrontmatterSchema.safeParse(withoutPublisher);
    expect(result.success).toBe(false);
  });

  it("rejects a CURATED item that also carries a body (wrong-shaped in the ORIGINAL direction)", () => {
    const result = contentItemFrontmatterSchema.safeParse({
      ...baseCurated,
      body: "This shouldn't be here.",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a non-https externalUrl", () => {
    const result = contentItemFrontmatterSchema.safeParse({
      ...baseCurated,
      externalUrl: "http://example.com/article",
    });
    expect(result.success).toBe(false);
  });

  it("rejects an unknown sourceType", () => {
    const result = contentItemFrontmatterSchema.safeParse({
      ...baseOriginal,
      sourceType: "SCRAPED",
    });
    expect(result.success).toBe(false);
  });

  it("rejects an unknown role archetype", () => {
    const result = contentItemFrontmatterSchema.safeParse({ ...baseOriginal, roles: ["WIZARD"] });
    expect(result.success).toBe(false);
  });

  it("rejects an unknown level", () => {
    const result = contentItemFrontmatterSchema.safeParse({ ...baseOriginal, level: "EXPERT" });
    expect(result.success).toBe(false);
  });

  it("rejects an unknown format", () => {
    const result = contentItemFrontmatterSchema.safeParse({ ...baseOriginal, format: "MAGAZINE" });
    expect(result.success).toBe(false);
  });
});

describe("videoBlockSchema — mandatory captions (decision #4)", () => {
  it("accepts a video block with both url and captionsUrl", () => {
    const result = videoBlockSchema.safeParse({
      url: "https://cdn.example.com/video.mp4",
      captionsUrl: "https://cdn.example.com/video.vtt",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a video block declared without captionsUrl", () => {
    const result = videoBlockSchema.safeParse({ url: "https://cdn.example.com/video.mp4" });
    expect(result.success).toBe(false);
  });

  it("rejects an ORIGINAL item whose video block has no captionsUrl", () => {
    const result = contentItemFrontmatterSchema.safeParse({
      ...baseOriginal,
      video: { url: "https://cdn.example.com/video.mp4" },
    });
    expect(result.success).toBe(false);
  });

  it("accepts an ORIGINAL item with a fully-formed video block", () => {
    const result = contentItemFrontmatterSchema.safeParse({
      ...baseOriginal,
      video: {
        url: "https://cdn.example.com/video.mp4",
        captionsUrl: "https://cdn.example.com/video.vtt",
      },
    });
    expect(result.success).toBe(true);
  });
});

describe("glossaryFrontmatterSchema — shortDefinition length cap", () => {
  const baseTerm = {
    slug: "artificial-intelligence",
    term: "Artificial Intelligence",
    shortDefinition: "A short definition.",
    lastReviewedAt: "2026-06-01",
    body: "A longer definition of the term.",
  };

  it("accepts a shortDefinition at or under 200 characters", () => {
    const result = glossaryFrontmatterSchema.safeParse({
      ...baseTerm,
      shortDefinition: "a".repeat(200),
    });
    expect(result.success).toBe(true);
  });

  it("rejects a shortDefinition over 200 characters", () => {
    const result = glossaryFrontmatterSchema.safeParse({
      ...baseTerm,
      shortDefinition: "a".repeat(201),
    });
    expect(result.success).toBe(false);
  });

  it("rejects an unknown status", () => {
    const result = glossaryFrontmatterSchema.safeParse({ ...baseTerm, status: "ARCHIVED" });
    expect(result.success).toBe(false);
  });
});
