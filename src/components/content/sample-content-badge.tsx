import type { SourceType } from "@prisma/client";
import { SAMPLE_CONTENT_LIBRARY, SAMPLE_CONTENT_NOTICE } from "@/lib/content/taxonomy";

/**
 * Decision #13: the "Sample content — not yet reviewed" notice for
 * `ORIGINAL` items while the R1 seed pack is unreviewed placeholder
 * editorial (task 19). `variant="inline"` is a compact chip for item
 * cards; `variant="banner"` is a one-line notice plus a clarifying
 * sentence for the lesson page. Not dismissible, not a client component;
 * `role="note"` with an accessible name so it's announced rather than
 * treated as decoration. Styled with the border/rounded conventions of
 * `src/components/account/verify-email-banner.tsx`.
 *
 * Returns `null` when `SAMPLE_CONTENT_LIBRARY` is `false` or the item isn't
 * `SourceType.ORIGINAL` — flipping that one constant once the library is
 * editorially reviewed removes every notice in the app in a single edit.
 * No schema field, no migration, no per-item frontmatter flag.
 */
export function SampleContentBadge({
  sourceType,
  variant,
}: {
  sourceType: SourceType;
  variant: "inline" | "banner";
}) {
  if (!SAMPLE_CONTENT_LIBRARY || sourceType !== "ORIGINAL") {
    return null;
  }

  if (variant === "inline") {
    return (
      <span
        role="note"
        aria-label={SAMPLE_CONTENT_NOTICE}
        className="inline-flex items-center rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-0.5 text-[10px] font-medium text-[var(--color-text-muted)]"
      >
        {SAMPLE_CONTENT_NOTICE}
      </span>
    );
  }

  return (
    <div
      role="note"
      aria-label={SAMPLE_CONTENT_NOTICE}
      className="mb-6 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-sm"
    >
      <p className="font-medium text-[var(--color-text)]">{SAMPLE_CONTENT_NOTICE}</p>
      <p className="mt-1 text-[var(--color-text-muted)]">
        This lesson is placeholder editorial written to demonstrate the platform&apos;s mechanisms —
        it has not yet been reviewed as instructional material.
      </p>
    </div>
  );
}
