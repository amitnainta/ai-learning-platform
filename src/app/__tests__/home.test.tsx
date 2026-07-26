import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import HomePage from "../page";

// Proves the Vitest + React Testing Library harness works end-to-end
// (AC1, AC3) — not a real product test.
describe("HomePage", () => {
  it("renders the placeholder heading", () => {
    render(<HomePage />);

    expect(screen.getByRole("heading", { name: /ai learning platform/i })).toBeInTheDocument();
  });
});
