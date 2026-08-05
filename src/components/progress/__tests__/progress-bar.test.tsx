import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ProgressBar } from "../progress-bar";
import { ProgressStatusBadge } from "../progress-status-badge";
import type { DisplayProgressStatus } from "@/lib/progress/status";
import { PROGRESS_STATUS_LABELS } from "@/lib/progress/status";

describe("ProgressBar", () => {
  it("renders role=progressbar with correct aria-valuenow/min/max and an aria-valuetext naming the counts", () => {
    render(
      <ProgressBar
        label="AI Foundations progress"
        completedCount={3}
        totalCount={8}
        percent={38}
      />,
    );

    const bar = screen.getByRole("progressbar");
    expect(bar).toHaveAttribute("aria-valuemin", "0");
    expect(bar).toHaveAttribute("aria-valuemax", "100");
    expect(bar).toHaveAttribute("aria-valuenow", "38");
    expect(bar).toHaveAttribute("aria-valuetext", "3 of 8 items complete (38%)");
  });

  it("has an accessible name from the label prop", () => {
    render(
      <ProgressBar
        label="AI Foundations progress"
        completedCount={3}
        totalCount={8}
        percent={38}
      />,
    );

    expect(
      screen.getByRole("progressbar", { name: "AI Foundations progress" }),
    ).toBeInTheDocument();
  });

  it("renders the visible percentage text matching aria-valuenow", () => {
    render(<ProgressBar label="Course progress" completedCount={5} totalCount={10} percent={50} />);
    expect(screen.getByText(/5 of 10 items complete \(50%\)/i)).toBeInTheDocument();
  });

  it("renders a 'no items yet' variant and no progressbar at totalCount === 0", () => {
    render(
      <ProgressBar label="Empty course progress" completedCount={0} totalCount={0} percent={0} />,
    );

    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
    expect(screen.getByText(/no items yet/i)).toBeInTheDocument();
  });
});

describe("ProgressStatusBadge", () => {
  it("renders label text (not colour alone) for every display status", () => {
    const statuses: DisplayProgressStatus[] = ["NOT_STARTED", "IN_PROGRESS", "COMPLETE"];
    for (const status of statuses) {
      const { unmount } = render(<ProgressStatusBadge status={status} />);
      expect(screen.getByText(PROGRESS_STATUS_LABELS[status])).toBeInTheDocument();
      unmount();
    }
  });
});
