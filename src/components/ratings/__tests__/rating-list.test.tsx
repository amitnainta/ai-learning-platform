import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { RatingList } from "../rating-list";
import type { RatingListEntry } from "@/lib/ratings/queries";

function buildEntry(overrides: Partial<RatingListEntry> = {}): RatingListEntry {
  return {
    id: "rating_1",
    stars: 4,
    feedback: "Great course, learned a lot.",
    createdAt: new Date("2026-01-15T00:00:00.000Z"),
    updatedAt: new Date("2026-01-15T00:00:00.000Z"),
    author: { name: "Ada Lovelace", roleArchetype: "TECHNICAL_BUILDER", level: "ADVANCED" },
    ...overrides,
  };
}

describe("RatingList", () => {
  it("renders an entry's name, role, level, date, stars, and feedback text", () => {
    render(
      <RatingList result={{ entries: [buildEntry()], totalWithFeedback: 1 }} isSignedIn={false} />,
    );

    expect(screen.getByText("Ada Lovelace")).toBeInTheDocument();
    expect(screen.getByText(/Technical Builder/)).toBeInTheDocument();
    expect(screen.getByText(/Advanced/)).toBeInTheDocument();
    expect(screen.getByText(/January 15, 2026/)).toBeInTheDocument();
    expect(screen.getByText("Great course, learned a lot.")).toBeInTheDocument();
    expect(screen.getByText(/4 out of 5/)).toBeInTheDocument();
  });

  it("renders nothing at all when there is no feedback yet", () => {
    const { container } = render(
      <RatingList result={{ entries: [], totalWithFeedback: 0 }} isSignedIn={false} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("a <script> payload renders as literal visible text with no <script> element created", () => {
    const payload = '<script>alert("xss")</script>';
    render(
      <RatingList
        result={{ entries: [buildEntry({ feedback: payload })], totalWithFeedback: 1 }}
        isSignedIn={false}
      />,
    );

    expect(document.querySelector("script")).toBeNull();
    expect(screen.getByText(payload)).toBeInTheDocument();
  });

  it("an <img onerror=...> payload renders as literal visible text with no matching <img> element", () => {
    const payload = '<img src=x onerror="alert(1)">';
    render(
      <RatingList
        result={{ entries: [buildEntry({ feedback: payload })], totalWithFeedback: 1 }}
        isSignedIn={false}
      />,
    );

    expect(document.querySelector("img[onerror]")).toBeNull();
    expect(screen.getByText(payload)).toBeInTheDocument();
  });

  it("newlines in feedback survive as separate visible lines", () => {
    const feedback = "Paragraph one.\n\nParagraph two.";
    render(
      <RatingList
        result={{ entries: [buildEntry({ feedback })], totalWithFeedback: 1 }}
        isSignedIn={false}
      />,
    );

    const feedbackElement = screen.getByText((_, node) => node?.textContent === feedback);
    expect(feedbackElement).toHaveClass("whitespace-pre-line");
  });

  it("renders the flag button for a signed-in non-author", () => {
    render(
      <RatingList
        result={{ entries: [buildEntry()], totalWithFeedback: 1 }}
        isSignedIn={true}
        currentUserRatingId="some-other-rating-id"
      />,
    );
    expect(
      screen.getByRole("button", { name: /report ada lovelace's rating/i }),
    ).toBeInTheDocument();
  });

  it("does not render the flag button for the author", () => {
    render(
      <RatingList
        result={{ entries: [buildEntry({ id: "my-rating" })], totalWithFeedback: 1 }}
        isSignedIn={true}
        currentUserRatingId="my-rating"
      />,
    );
    expect(screen.queryByRole("button", { name: /report/i })).not.toBeInTheDocument();
  });

  it("does not render the flag button for an anonymous viewer", () => {
    render(
      <RatingList result={{ entries: [buildEntry()], totalWithFeedback: 1 }} isSignedIn={false} />,
    );
    expect(screen.queryByRole("button", { name: /report/i })).not.toBeInTheDocument();
  });

  it("shows the 'showing N of M' line only when truncated", () => {
    const { rerender } = render(
      <RatingList result={{ entries: [buildEntry()], totalWithFeedback: 1 }} isSignedIn={false} />,
    );
    expect(screen.queryByText(/showing/i)).not.toBeInTheDocument();

    rerender(
      <RatingList result={{ entries: [buildEntry()], totalWithFeedback: 30 }} isSignedIn={false} />,
    );
    expect(screen.getByText("Showing 1 of 30")).toBeInTheDocument();
  });
});
