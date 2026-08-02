import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getGlossaryTerm, getGlossaryTermsBySlugs } from "@/lib/content/queries";
import { findGlossaryLinks } from "@/lib/content/loader";
import { glossaryUrl } from "@/lib/content/routes";
import { Markdown } from "@/components/content/markdown";

export const dynamic = "force-dynamic";

interface GlossaryTermPageParams {
  slug: string;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<GlossaryTermPageParams>;
}): Promise<Metadata> {
  const { slug } = await params;
  const term = await getGlossaryTerm(slug);
  if (!term) {
    return { title: "Term not found — AI Learning Platform" };
  }
  return {
    title: `${term.term} — Glossary — AI Learning Platform`,
    description: term.shortDefinition,
  };
}

// One glossary term — the term, its short definition, the long definition
// through <Markdown>, aliases, related terms, and a back-link.
export default async function GlossaryTermPage({
  params,
}: {
  params: Promise<GlossaryTermPageParams>;
}) {
  const { slug } = await params;
  const term = await getGlossaryTerm(slug);
  if (!term) {
    notFound();
  }

  const bodyGlossarySlugs = findGlossaryLinks(term.body);
  const [relatedTerms, bodyTerms] = await Promise.all([
    getGlossaryTermsBySlugs(term.relatedSlugs),
    getGlossaryTermsBySlugs(bodyGlossarySlugs),
  ]);

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <Link href="/glossary" className="text-sm text-[var(--color-primary)] hover:underline">
        ← Glossary
      </Link>

      <h1 className="mt-4 mb-2 text-2xl font-semibold text-[var(--color-text)]">{term.term}</h1>
      {term.aliases.length > 0 ? (
        <p className="mb-4 text-sm text-[var(--color-text-muted)]">
          Also known as: {term.aliases.join(", ")}
        </p>
      ) : null}
      <p className="mb-6 font-medium text-[var(--color-text)]">{term.shortDefinition}</p>

      <Markdown content={term.body} glossaryTerms={bodyTerms} />

      {term.relatedSlugs.length > 0 ? (
        <div className="mt-8">
          <h2 className="mb-2 text-sm font-medium text-[var(--color-text)]">Related terms</h2>
          <ul className="flex flex-wrap gap-2">
            {term.relatedSlugs.map((relatedSlug) => {
              const related = relatedTerms.get(relatedSlug);
              return (
                <li key={relatedSlug}>
                  <Link
                    href={glossaryUrl(relatedSlug)}
                    className="rounded-full border border-[var(--color-border)] px-3 py-1 text-xs text-[var(--color-text)] hover:bg-[var(--color-surface-hover)]"
                  >
                    {related?.term ?? relatedSlug}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
