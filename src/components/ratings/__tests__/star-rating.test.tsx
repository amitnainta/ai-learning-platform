import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StarRatingInput } from "../star-rating-input";
import { StarRatingDisplay } from "../star-rating-display";

describe("StarRatingInput", () => {
  it("exposes a radio group with an accessible group name and five radios named '1 star' to '5 stars'", () => {
    render(<StarRatingInput name="course-stars" value={null} onChange={() => {}} />);

    expect(screen.getByRole("group", { name: /your rating/i })).toBeInTheDocument();
    const radios = screen.getAllByRole("radio");
    expect(radios).toHaveLength(5);
    for (let star = 1; star <= 5; star += 1) {
      expect(
        screen.getByRole("radio", { name: `${star} star${star === 1 ? "" : "s"}` }),
      ).toBeInTheDocument();
    }
  });

  it("arrow keys move the selection and onChange fires with the numeric value", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<StarRatingInput name="course-stars" value={2} onChange={onChange} />);

    const secondRadio = screen.getByRole("radio", { name: "2 stars" });
    secondRadio.focus();
    await user.keyboard("{ArrowRight}");

    expect(onChange).toHaveBeenCalledWith(3);
  });

  it("clicking a star calls onChange with that value", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<StarRatingInput name="course-stars" value={null} onChange={onChange} />);

    await user.click(screen.getByRole("radio", { name: "4 stars" }));
    expect(onChange).toHaveBeenCalledWith(4);
  });

  it("the selected value appears as visible text", () => {
    render(<StarRatingInput name="course-stars" value={4} onChange={() => {}} />);
    expect(screen.getByText("4 out of 5")).toBeInTheDocument();
  });

  it("shows 'No rating selected' when value is null", () => {
    render(<StarRatingInput name="course-stars" value={null} onChange={() => {}} />);
    expect(screen.getByText("No rating selected")).toBeInTheDocument();
  });
});

describe("StarRatingDisplay", () => {
  it("renders the average and count as visible text", () => {
    render(<StarRatingDisplay aggregate={{ average: 4.25, count: 12 }} />);
    expect(screen.getByText(/4\.3 out of 5/)).toBeInTheDocument();
    expect(screen.getByText(/12 ratings/)).toBeInTheDocument();
  });

  it("has an accessible name naming the average and count (not colour/glyph alone)", () => {
    render(<StarRatingDisplay aggregate={{ average: 4.25, count: 12 }} />);
    expect(
      screen.getByRole("img", { name: "Average rating 4.3 out of 5, from 12 ratings" }),
    ).toBeInTheDocument();
  });

  it('renders the "Not yet rated" variant at count 0', () => {
    render(<StarRatingDisplay aggregate={{ average: null, count: 0 }} />);
    expect(screen.getByText("Not yet rated")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Not yet rated" })).toBeInTheDocument();
  });
});
