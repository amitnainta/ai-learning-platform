import type { Metadata } from "next";
import Link from "next/link";
import { listGlossaryTerms } from "@/lib/content/queries";
import { glossaryUrl } from "@/lib/content/routes";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Glossary — AI Learning Platform",
  description: "Plain-language definitions of AI/ML terms used across the learning paths.",
};

// FR-PATH-008 / FR-ACC-008: alphabetical index of published terms with
// their short definitions, anchored by first letter, reachable anonymously.
export default async function GlossaryIndexPage() {
  const terms = await listGlossaryTerms();

  const groups = new Map<string, typeof terms>();
  for (const term of terms) {
    const letter = term.term.charAt(0).toUpperCase();
    const group = groups.get(letter) ?? [];
    group.push(term);
    groups.set(letter, group);
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="mb-2 text-2xl font-semibold text-[var(--color-text)]">Glossary</h1>
      <p className="mb-8 text-[var(--color-text-muted)]">
        Plain-language definitions of the terms used across every learning path.
      </p>

      {[...groups.entries()].map(([letter, letterTerms]) => (
        <section key={letter} id={`letter-${letter}`} className="mb-8">
          <h2 className="mb-3 text-sm font-semibold text-[var(--color-text-muted)]">{letter}</h2>
          <dl className="flex flex-col gap-4">
            {letterTerms.map((term) => (
              <div key={term.id}>
                <dt>
                  <Link
                    href={glossaryUrl(term.slug)}
                    className="font-medium text-[var(--color-text)] hover:underline"
                  >
                    {term.term}
                  </Link>
                </dt>
                <dd className="text-sm text-[var(--color-text-muted)]">{term.shortDefinition}</dd>
              </div>
            ))}
          </dl>
        </section>
      ))}
    </div>
  );
}
