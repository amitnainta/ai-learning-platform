import Link from "next/link";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { GlossaryLink } from "@/components/content/glossary-link";
import { ExternalLink } from "@/components/content/external-link";

/**
 * Server component wrapping `react-markdown` + `remark-gfm` with a
 * component map (task 15, decision #3): `glossary:` hrefs render
 * `<GlossaryLink>`, external hrefs render `<ExternalLink>`, internal hrefs
 * render `next/link`, and headings get stable ids. Bodies are stored as
 * Markdown *text* and parsed to a React element tree at render time — no
 * HTML string is ever produced, so there is no `dangerouslySetInnerHTML`
 * anywhere in this pipeline. `rehype-raw` is deliberately not used, so any
 * raw HTML embedded in a Markdown body (e.g. a stray `<script>` tag) is
 * rendered as inert literal text rather than executed (NFR-SEC-007) — this
 * is what keeps the pipeline safe even once user-submitted text arrives
 * with FR-RATE.
 */

export interface GlossaryTermLookup {
  slug: string;
  term: string;
  shortDefinition: string;
}

const GLOSSARY_PROTOCOL = "glossary:";

function slugifyHeading(children: React.ReactNode): string {
  const text = flattenText(children);
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-");
}

function flattenText(node: React.ReactNode): string {
  if (typeof node === "string" || typeof node === "number") {
    return String(node);
  }
  if (Array.isArray(node)) {
    return node.map(flattenText).join("");
  }
  if (node && typeof node === "object" && "props" in node) {
    const props = (node as { props?: { children?: React.ReactNode } }).props;
    return flattenText(props?.children);
  }
  return "";
}

function headingComponent(level: 1 | 2 | 3 | 4 | 5 | 6) {
  const Tag = `h${level}` as const;
  const sizeClass =
    level === 1
      ? "text-2xl font-semibold"
      : level === 2
        ? "text-xl font-semibold"
        : "text-lg font-medium";
  // eslint-disable-next-line react/display-name
  return ({ children, ...props }: React.ComponentPropsWithoutRef<typeof Tag>) => {
    const id = slugifyHeading(children);
    return (
      <Tag
        id={id}
        className={`mt-6 mb-2 scroll-mt-20 text-[var(--color-text)] ${sizeClass}`}
        {...props}
      >
        {children}
      </Tag>
    );
  };
}

function buildComponents(glossaryTerms?: Map<string, GlossaryTermLookup>): Components {
  return {
    h1: headingComponent(1),
    h2: headingComponent(2),
    h3: headingComponent(3),
    h4: headingComponent(4),
    h5: headingComponent(5),
    h6: headingComponent(6),
    p: ({ children }) => (
      <p className="mb-4 leading-relaxed text-[var(--color-text)]">{children}</p>
    ),
    ul: ({ children }) => (
      <ul className="mb-4 ml-6 list-disc space-y-1 text-[var(--color-text)]">{children}</ul>
    ),
    ol: ({ children }) => (
      <ol className="mb-4 ml-6 list-decimal space-y-1 text-[var(--color-text)]">{children}</ol>
    ),
    li: ({ children }) => <li>{children}</li>,
    blockquote: ({ children }) => (
      <blockquote className="mb-4 border-l-2 border-[var(--color-border)] pl-4 text-[var(--color-text-muted)] italic">
        {children}
      </blockquote>
    ),
    code: ({ className, children, ...props }) => {
      const isBlock = Boolean(className);
      if (!isBlock) {
        return (
          <code
            className="rounded bg-[var(--color-surface-hover)] px-1 py-0.5 text-sm text-[var(--color-text)]"
            {...props}
          >
            {children}
          </code>
        );
      }
      return (
        <code className={`${className ?? ""} text-sm text-[var(--color-text)]`} {...props}>
          {children}
        </code>
      );
    },
    pre: ({ children }) => (
      <pre className="mb-4 overflow-x-auto rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
        {children}
      </pre>
    ),
    a: ({ href, children }) => {
      if (!href) {
        return <>{children}</>;
      }
      if (href.startsWith(GLOSSARY_PROTOCOL)) {
        const slug = href.slice(GLOSSARY_PROTOCOL.length);
        return (
          <GlossaryLink slug={slug} term={glossaryTerms?.get(slug) ?? null}>
            {children}
          </GlossaryLink>
        );
      }
      if (/^[a-z][a-z0-9+.-]*:\/\//i.test(href)) {
        return <ExternalLink href={href}>{children}</ExternalLink>;
      }
      return <Link href={href}>{children}</Link>;
    },
  };
}

export function Markdown({
  content,
  glossaryTerms,
}: {
  content: string;
  glossaryTerms?: Map<string, GlossaryTermLookup>;
}) {
  return (
    <div className="max-w-none">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={buildComponents(glossaryTerms)}>
        {content}
      </ReactMarkdown>
    </div>
  );
}
