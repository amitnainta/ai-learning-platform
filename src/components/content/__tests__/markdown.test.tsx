import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Markdown } from "../markdown";

describe("Markdown", () => {
  it("renders a glossary: link as an anchor to /glossary/<slug>", () => {
    render(<Markdown content="See [machine learning](glossary:machine-learning) for more." />);

    const link = screen.getByRole("link", { name: /machine learning/i });
    expect(link).toHaveAttribute("href", "/glossary/machine-learning");
  });

  it("renders the glossary link's hover/focus definition when the term is supplied", () => {
    const glossaryTerms = new Map([
      [
        "machine-learning",
        {
          slug: "machine-learning",
          term: "Machine Learning",
          shortDefinition: "Learning from data.",
        },
      ],
    ]);
    render(
      <Markdown
        content="See [machine learning](glossary:machine-learning) for more."
        glossaryTerms={glossaryTerms}
      />,
    );

    expect(screen.getByText(/learning from data/i)).toBeInTheDocument();
  });

  it("renders an external link with target=_blank and a rel containing noopener and noreferrer", () => {
    render(<Markdown content="Read [this article](https://example.com/article) for more." />);

    const link = screen.getByRole("link", { name: /this article/i });
    expect(link).toHaveAttribute("target", "_blank");
    expect(link.getAttribute("rel")).toContain("noopener");
    expect(link.getAttribute("rel")).toContain("noreferrer");
    expect(link).toHaveAttribute("href", "https://example.com/article");
  });

  it("renders an internal link with neither target=_blank nor an external rel", () => {
    render(<Markdown content="See the [glossary index](/glossary) for definitions." />);

    const link = screen.getByRole("link", { name: /glossary index/i });
    expect(link).toHaveAttribute("href", "/glossary");
    expect(link).not.toHaveAttribute("target");
    expect(link.getAttribute("rel") ?? "").not.toContain("noopener");
  });

  it("renders raw HTML in the source as literal text and executes nothing", () => {
    const { container } = render(
      <Markdown content={"Some text with a <script>window.__pwned = true;</script> tag."} />,
    );

    // No <script> element was created — react-markdown without rehype-raw
    // leaves raw HTML as inert text (NFR-SEC-007), never
    // dangerouslySetInnerHTML.
    expect(container.querySelector("script")).toBeNull();
    expect((window as unknown as { __pwned?: boolean }).__pwned).toBeUndefined();
    expect(container.textContent).toContain("<script>");
  });

  it("renders a raw <img onerror=...> tag as literal text, not a live element", () => {
    const { container } = render(
      <Markdown content={'Text with <img src=x onerror="window.__pwned2 = true">.'} />,
    );

    expect(container.querySelector("img")).toBeNull();
    expect((window as unknown as { __pwned2?: boolean }).__pwned2).toBeUndefined();
  });

  it("gives headings a stable, slugified id", () => {
    render(<Markdown content={"## Hello World\n\nSome text."} />);

    const heading = screen.getByRole("heading", { name: /hello world/i });
    expect(heading).toHaveAttribute("id", "hello-world");
  });
});
