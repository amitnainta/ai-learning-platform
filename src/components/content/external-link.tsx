import type { ReactNode } from "react";

/**
 * FR-PATH-006 / NFR-COMP-001: an anchor to an external, curated resource.
 * `target="_blank" rel="noopener noreferrer"`, an "opens in a new tab"
 * affordance (including screen-reader text), and the destination host
 * rendered next to the label (task 17).
 */
export function ExternalLink({ href, children }: { href: string; children: ReactNode }) {
  let host: string | null = null;
  try {
    host = new URL(href).host;
  } catch {
    host = null;
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-[var(--color-primary)] underline underline-offset-2 hover:text-[var(--color-primary-hover)]"
    >
      {children}
      {host ? <span className="ml-1 text-xs text-[var(--color-text-muted)]">({host})</span> : null}
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  );
}
