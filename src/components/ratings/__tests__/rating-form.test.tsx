import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RatingForm } from "../rating-form";
import { FEEDBACK_MAX_LENGTH } from "@/lib/validation/rating";

const refreshMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: refreshMock }),
}));

beforeEach(() => {
  refreshMock.mockClear();
});

describe("RatingForm — new rating", () => {
  it("submitting posts /api/ratings with the chosen stars and feedback", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, aggregate: { average: 4, count: 1 } }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const user = userEvent.setup();
    render(
      <RatingForm
        targetType="course"
        targetSlug="ai-foundations"
        prompt="What did you think?"
        initialRating={null}
      />,
    );

    await user.click(screen.getByRole("radio", { name: "4 stars" }));
    await user.type(screen.getByLabelText("What did you think?"), "Great course");
    await user.click(screen.getByRole("button", { name: /submit rating/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/ratings",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            targetType: "course",
            targetSlug: "ai-foundations",
            stars: 4,
            feedback: "Great course",
          }),
        }),
      );
    });
    expect(refreshMock).toHaveBeenCalled();

    vi.unstubAllGlobals();
  });

  it("the character counter updates as feedback is typed", async () => {
    const user = userEvent.setup();
    render(
      <RatingForm
        targetType="course"
        targetSlug="ai-foundations"
        prompt="What did you think?"
        initialRating={null}
      />,
    );

    await user.type(screen.getByLabelText("What did you think?"), "hello");
    expect(screen.getByText(`5 / ${FEEDBACK_MAX_LENGTH} characters`)).toBeInTheDocument();
  });

  it("submission over the cap is blocked with an inline error", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    render(
      <RatingForm
        targetType="course"
        targetSlug="ai-foundations"
        prompt="What did you think?"
        initialRating={null}
      />,
    );

    // Bypass the native maxLength attribute (as a pasted/scripted payload
    // would) to exercise the schema-independent client-side length guard.
    const textarea = screen.getByLabelText("What did you think?") as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: "a".repeat(FEEDBACK_MAX_LENGTH + 1) } });

    const radios = screen.getAllByRole("radio") as HTMLInputElement[];
    fireEvent.click(radios[2]!);

    const form = textarea.closest("form")!;
    fireEvent.submit(form);

    await waitFor(() => {
      expect(screen.getAllByText(/characters or fewer/i).length).toBeGreaterThan(0);
    });
    expect(fetchMock).not.toHaveBeenCalled();

    vi.unstubAllGlobals();
  });

  it("the public-visibility notice is present", () => {
    render(
      <RatingForm
        targetType="course"
        targetSlug="ai-foundations"
        prompt="What did you think?"
        initialRating={null}
      />,
    );

    expect(screen.getByText(/shown publicly/i)).toBeInTheDocument();
  });

  it("disables the controls while the request is pending", async () => {
    let resolveFetch: (value: unknown) => void = () => {};
    const fetchMock = vi.fn(
      () =>
        new Promise((resolve) => {
          resolveFetch = resolve;
        }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const user = userEvent.setup();
    render(
      <RatingForm
        targetType="course"
        targetSlug="ai-foundations"
        prompt="What did you think?"
        initialRating={null}
      />,
    );

    await user.click(screen.getByRole("radio", { name: "3 stars" }));
    const submitButton = screen.getByRole("button", { name: /submit rating/i });
    await user.click(submitButton);

    expect(submitButton).toBeDisabled();
    resolveFetch({
      ok: true,
      json: async () => ({ success: true, aggregate: { average: 3, count: 1 } }),
    });

    vi.unstubAllGlobals();
  });

  it("a failed request shows an inline error and announces it in the live region", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ success: false, error: "Something went wrong" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const user = userEvent.setup();
    render(
      <RatingForm
        targetType="course"
        targetSlug="ai-foundations"
        prompt="What did you think?"
        initialRating={null}
      />,
    );

    await user.click(screen.getByRole("radio", { name: "3 stars" }));
    await user.click(screen.getByRole("button", { name: /submit rating/i }));

    await waitFor(() => {
      expect(screen.getAllByText("Something went wrong").length).toBeGreaterThan(0);
    });
    expect(refreshMock).not.toHaveBeenCalled();

    vi.unstubAllGlobals();
  });
});

describe("RatingForm — existing rating", () => {
  it("prefills and the button reads 'Update your rating'", () => {
    render(
      <RatingForm
        targetType="course"
        targetSlug="ai-foundations"
        prompt="What did you think?"
        initialRating={{ stars: 4, feedback: "Already rated this", hiddenAt: null }}
      />,
    );

    expect(screen.getByRole("radio", { name: "4 stars" })).toBeChecked();
    expect(screen.getByDisplayValue("Already rated this")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /update your rating/i })).toBeInTheDocument();
  });

  it("'Remove my rating' issues a DELETE", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, aggregate: { average: null, count: 0 } }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const user = userEvent.setup();
    render(
      <RatingForm
        targetType="course"
        targetSlug="ai-foundations"
        prompt="What did you think?"
        initialRating={{ stars: 4, feedback: "Already rated this", hiddenAt: null }}
      />,
    );

    await user.click(screen.getByRole("button", { name: /remove my rating/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/ratings",
        expect.objectContaining({
          method: "DELETE",
          body: JSON.stringify({ targetType: "course", targetSlug: "ai-foundations" }),
        }),
      );
    });
    expect(refreshMock).toHaveBeenCalled();

    vi.unstubAllGlobals();
  });

  it("shows the hidden notice when the rating is currently hidden", () => {
    render(
      <RatingForm
        targetType="course"
        targetSlug="ai-foundations"
        prompt="What did you think?"
        initialRating={{ stars: 4, feedback: "x", hiddenAt: new Date().toISOString() }}
      />,
    );

    expect(screen.getByText(/not currently shown publicly/i)).toBeInTheDocument();
  });
});
