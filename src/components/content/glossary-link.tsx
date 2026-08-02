import { randomUUID } from "node:crypto";
import type { ReactNode } from "react";
import Link from "next/link";
import { glossaryUrl } from "@/lib/content/routes";
import type { GlossaryTermLookup } from "@/components/content/markdown";

/**
 * FR-PATH-008: renders an anchor to `/glossary/<slug>` with a dotted
 * underline plus an inline definition revealed on hover **and** on
 * keyboard focus, associated via `aria-describedby` so screen readers
 * announce it (task 16). CSS-only (Tailwind `group`/`group-focus-within`),
 * no JS, and works inside a server component. Falls back to a plain link
 * when the term isn't in the supplied lookup map (e.g. a retired term).
 */
export function GlossaryLink({
  slug,
  term,
  children,
}: {
  slug: string;
  term: GlossaryTermLookup | null;
  children: ReactNode;
}) {
  if (!term) {
    return (
      <Link href={glossaryUrl(slug)} className="underline decoration-dotted underline-offset-2">
        {children}
      </Link>
    );
  }

  const descriptionId = `glossary-tooltip-${slug}-${randomUUID()}`;

  return (
    <span className="group relative inline-block">
      <Link
        href={glossaryUrl(slug)}
        aria-describedby={descriptionId}
        className="text-[var(--color-primary)] underline decoration-[var(--color-primary)] decoration-dotted underline-offset-2"
      >
        {children}
      </Link>
      <span
        id={descriptionId}
        role="tooltip"
        className="pointer-events-none absolute top-full left-0 z-10 mt-1 w-64 -translate-y-1 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-2 text-xs text-[var(--color-text)] opacity-0 shadow-lg transition-all group-focus-within:translate-y-0 group-focus-within:opacity-100 group-hover:translate-y-0 group-hover:opacity-100"
      >
        <strong className="text-[var(--color-text)]">{term.term}:</strong> {term.shortDefinition}
      </span>
    </span>
  );
}
