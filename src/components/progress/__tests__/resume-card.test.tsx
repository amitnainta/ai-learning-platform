import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ResumeCard } from "../resume-card";
import type { ResumeTarget } from "@/lib/progress/percent";

describe("ResumeCard", () => {
  it("renders nothing for the empty state", () => {
    const { container } = render(
      <ResumeCard
        target={{ kind: "empty" }}
        scope="path"
        backHref="/paths/technical-builder/zero-knowledge"
        backLabel="Technical Builder — Zero Knowledge"
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("the start state reads 'Start' and links to the first item", () => {
    const target: ResumeTarget = {
      kind: "start",
      item: {
        id: "item-1",
        slug: "what-is-artificial-intelligence",
        title: "What Is Artificial Intelligence?",
        sourceType: "ORIGINAL",
        position: 0,
      },
      course: { slug: "ai-foundations-for-builders", title: "AI Foundations for Builders" },
    };
    render(
      <ResumeCard
        target={target}
        scope="path"
        backHref="/paths/technical-builder/zero-knowledge"
        backLabel="Technical Builder — Zero Knowledge"
      />,
    );

    expect(screen.getByText(/start the path/i)).toBeInTheDocument();
    const link = screen.getByRole("link", { name: /start: what is artificial intelligence\?/i });
    expect(link).toHaveAttribute("href", "/lessons/what-is-artificial-intelligence");
  });

  it("the resume state names the item and links to /lessons/<slug> for an original item", () => {
    const target: ResumeTarget = {
      kind: "resume",
      item: {
        id: "item-2",
        slug: "how-machine-learning-works",
        title: "How Machine Learning Works",
        sourceType: "ORIGINAL",
        position: 1,
      },
      course: { slug: "ai-foundations-for-builders", title: "AI Foundations for Builders" },
    };
    render(
      <ResumeCard
        target={target}
        scope="path"
        backHref="/paths/technical-builder/zero-knowledge"
        backLabel="Technical Builder — Zero Knowledge"
      />,
    );

    const link = screen.getByRole("link", { name: /resume: how machine learning works/i });
    expect(link).toHaveAttribute("href", "/lessons/how-machine-learning-works");
  });

  it("the resume state links to the course anchor for a curated item", () => {
    const target: ResumeTarget = {
      kind: "resume",
      item: {
        id: "item-3",
        slug: "google-ai-crash-course",
        title: "Machine Learning Crash Course",
        sourceType: "CURATED",
        position: 2,
      },
      course: { slug: "ai-foundations-for-builders", title: "AI Foundations for Builders" },
    };
    render(
      <ResumeCard
        target={target}
        scope="path"
        backHref="/paths/technical-builder/zero-knowledge"
        backLabel="Technical Builder — Zero Knowledge"
      />,
    );

    const link = screen.getByRole("link", { name: /resume: machine learning crash course/i });
    expect(link).toHaveAttribute(
      "href",
      "/courses/ai-foundations-for-builders#item-google-ai-crash-course",
    );
  });

  it("the complete state renders the completion message and no resume link", () => {
    render(
      <ResumeCard
        target={{ kind: "complete" }}
        scope="path"
        backHref="/paths/technical-builder/zero-knowledge"
        backLabel="Technical Builder — Zero Knowledge"
      />,
    );

    expect(screen.getByText(/path complete/i)).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /^resume:/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /^start:/i })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /back to technical builder/i })).toHaveAttribute(
      "href",
      "/paths/technical-builder/zero-knowledge",
    );
  });

  it("labels the complete state as 'Course complete' when scope is course", () => {
    render(
      <ResumeCard
        target={{ kind: "complete" }}
        scope="course"
        backHref="/courses/ai-foundations-for-builders"
        backLabel="AI Foundations for Builders"
      />,
    );
    expect(screen.getByText(/course complete/i)).toBeInTheDocument();
  });
});
