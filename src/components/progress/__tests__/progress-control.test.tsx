import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ProgressControl } from "../progress-control";

const refreshMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: refreshMock }),
}));

beforeEach(() => {
  refreshMock.mockClear();
});

describe("ProgressControl", () => {
  it("includes the item title in the button's accessible name", () => {
    render(
      <ProgressControl
        contentItemSlug="what-is-artificial-intelligence"
        contentItemTitle="What Is Artificial Intelligence?"
        initialStatus="IN_PROGRESS"
      />,
    );

    expect(
      screen.getByRole("button", { name: /mark complete.*what is artificial intelligence\?/i }),
    ).toBeInTheDocument();
  });

  it("clicking POSTs the complete action and flips the label optimistically", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, progress: { status: "COMPLETE" } }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const user = userEvent.setup();
    render(
      <ProgressControl
        contentItemSlug="what-is-artificial-intelligence"
        contentItemTitle="What Is AI?"
        initialStatus="IN_PROGRESS"
      />,
    );

    await user.click(screen.getByRole("button", { name: /mark complete/i }));

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/progress",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          contentItemSlug: "what-is-artificial-intelligence",
          action: "complete",
        }),
      }),
    );

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /mark as not complete/i })).toBeInTheDocument();
    });
    expect(refreshMock).toHaveBeenCalled();

    vi.unstubAllGlobals();
  });

  it("clicking again on a complete item sends the reopen action", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, progress: { status: "IN_PROGRESS" } }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const user = userEvent.setup();
    render(
      <ProgressControl
        contentItemSlug="what-is-artificial-intelligence"
        contentItemTitle="What Is AI?"
        initialStatus="COMPLETE"
      />,
    );

    await user.click(screen.getByRole("button", { name: /mark as not complete/i }));

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/progress",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          contentItemSlug: "what-is-artificial-intelligence",
          action: "reopen",
        }),
      }),
    );

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /^mark complete/i })).toBeInTheDocument();
    });

    vi.unstubAllGlobals();
  });

  it("a failed request reverts the label and shows an inline error", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false });
    vi.stubGlobal("fetch", fetchMock);

    const user = userEvent.setup();
    render(
      <ProgressControl
        contentItemSlug="what-is-artificial-intelligence"
        contentItemTitle="What Is AI?"
        initialStatus="IN_PROGRESS"
      />,
    );

    await user.click(screen.getByRole("button", { name: /mark complete/i }));

    await waitFor(() => {
      expect(screen.getAllByText(/could not update your progress/i).length).toBeGreaterThan(0);
    });
    expect(screen.getByRole("button", { name: /^mark complete/i })).toBeInTheDocument();
    expect(refreshMock).not.toHaveBeenCalled();

    vi.unstubAllGlobals();
  });

  it("disables the button while the request is pending", async () => {
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
      <ProgressControl
        contentItemSlug="what-is-artificial-intelligence"
        contentItemTitle="What Is AI?"
        initialStatus="IN_PROGRESS"
      />,
    );

    const button = screen.getByRole("button", { name: /mark complete/i });
    await user.click(button);

    expect(button).toBeDisabled();
    resolveFetch({
      ok: true,
      json: async () => ({ success: true, progress: { status: "COMPLETE" } }),
    });

    vi.unstubAllGlobals();
  });

  it("announces the result in an aria-live region", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, progress: { status: "COMPLETE" } }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const user = userEvent.setup();
    render(
      <ProgressControl
        contentItemSlug="what-is-artificial-intelligence"
        contentItemTitle="What Is AI?"
        initialStatus="IN_PROGRESS"
      />,
    );

    await user.click(screen.getByRole("button", { name: /mark complete/i }));

    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent(/marked "what is ai\?" as complete/i);
    });

    vi.unstubAllGlobals();
  });
});
