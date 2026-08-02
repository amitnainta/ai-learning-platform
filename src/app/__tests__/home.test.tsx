import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import HomePage from "../page";

// Proves the Vitest + React Testing Library harness works end-to-end
// (AC1, AC3) — not a real product test.
describe("HomePage", () => {
  it("renders the heading", () => {
    render(<HomePage />);

    expect(screen.getByRole("heading", { name: /ai learning platform/i })).toBeInTheDocument();
  });

  // Task 32/48 (learning-paths-content): the primary call to action now
  // links into the new content surface, alongside the existing sign-up/
  // sign-in actions.
  it("links its primary call to action to /paths", () => {
    render(<HomePage />);

    expect(screen.getByRole("link", { name: /browse learning paths/i })).toHaveAttribute(
      "href",
      "/paths",
    );
    expect(screen.getByRole("link", { name: /get started/i })).toHaveAttribute("href", "/sign-up");
    expect(screen.getByRole("link", { name: /^sign in$/i })).toHaveAttribute("href", "/sign-in");
  });
});
