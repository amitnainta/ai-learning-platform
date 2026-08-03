import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ContentItemCard, type ContentItemCardData } from "../content-item-card";

const baseTags = {
  roles: ["TECHNICAL_BUILDER"] as ContentItemCardData["roles"],
  level: "ZERO_KNOWLEDGE" as ContentItemCardData["level"],
  format: "ARTICLE" as ContentItemCardData["format"],
  estimatedMinutes: 12,
  topics: [{ slug: "ai-fundamentals", label: "AI Fundamentals" }],
};

const curatedItem: ContentItemCardData = {
  ...baseTags,
  slug: "curated-item",
  title: "A Curated Resource",
  summary: "Summary of the resource.",
  sourceType: "CURATED",
  lastReviewedAt: new Date("2026-06-01"),
  externalUrl: "https://example.com/resource",
  sourcePublisher: "Example Publisher",
  sourceAuthor: "Jane Author",
  attributionNote: "A helpful note.",
};

const originalItem: ContentItemCardData = {
  ...baseTags,
  slug: "original-item",
  title: "An Original Lesson",
  summary: "Summary of the lesson.",
  sourceType: "ORIGINAL",
  lastReviewedAt: new Date("2026-06-01"),
  externalUrl: null,
  sourcePublisher: null,
  sourceAuthor: null,
  attributionNote: null,
};

describe("ContentItemCard", () => {
  it("renders a curated item's publisher attribution and links to the external URL in a new tab", () => {
    render(<ContentItemCard item={curatedItem} />);

    const link = screen.getByRole("link", { name: /open this resource/i });
    expect(link).toHaveAttribute("href", "https://example.com/resource");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link.getAttribute("rel")).toContain("noopener");
    expect(screen.getByText(/example publisher/i)).toBeInTheDocument();
    expect(screen.getByText(/jane author/i)).toBeInTheDocument();
    expect(screen.getByText(/a helpful note/i)).toBeInTheDocument();
  });

  it("renders an original item with an internal link and no external attribution", () => {
    render(<ContentItemCard item={originalItem} />);

    const link = screen.getByRole("link", { name: /an original lesson/i });
    expect(link).toHaveAttribute("href", "/lessons/original-item");
    expect(link).not.toHaveAttribute("target");
    expect(screen.queryByText(/example publisher/i)).not.toBeInTheDocument();
  });

  it("renders every FR-PATH-004 tag for both source types", () => {
    render(<ContentItemCard item={curatedItem} />);
    expect(screen.getByText(/technical builder/i)).toBeInTheDocument();
    expect(screen.getByText(/zero knowledge/i)).toBeInTheDocument();
    expect(screen.getByText(/^article$/i)).toBeInTheDocument();
    expect(screen.getByText(/12 min/i)).toBeInTheDocument();
    expect(screen.getByText(/curated \(external\)/i)).toBeInTheDocument();
    expect(screen.getByText(/ai fundamentals/i)).toBeInTheDocument();
  });

  it("renders the last-reviewed date on both source types", () => {
    render(<ContentItemCard item={originalItem} />);
    expect(screen.getByText(/last reviewed june 1, 2026/i)).toBeInTheDocument();
  });

  it("renders the sample-content notice on an original item but not on a curated item (decision #13)", () => {
    const { rerender } = render(<ContentItemCard item={originalItem} />);
    expect(screen.getByText(/sample content — not yet reviewed/i)).toBeInTheDocument();

    rerender(<ContentItemCard item={curatedItem} />);
    expect(screen.queryByText(/sample content — not yet reviewed/i)).not.toBeInTheDocument();
  });
});
