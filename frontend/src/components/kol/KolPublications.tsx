import { useState } from 'react';
import { ExternalLink } from 'lucide-react';
import type { KolPublication } from '../../api/kol-network';

const INITIAL_COUNT = 10;

/** Curated publications under a KOL's bio: newest first, the first ten shown. */
export function KolPublications({
  publications,
  variant = 'section',
}: {
  publications?: KolPublication[];
  variant?: 'section' | 'card';
}) {
  const [showAll, setShowAll] = useState(false);
  if (!publications || publications.length === 0) return null;

  const visible = showAll ? publications : publications.slice(0, INITIAL_COUNT);
  const hidden = publications.length - INITIAL_COUNT;

  const list = (
    <>
      <ul className="mt-3 divide-y divide-hairline border-y border-hairline">
        {visible.map((p) => (
          <li key={p.url ?? p.title} className="py-3">
            {p.url ? (
              <a
                href={p.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group inline text-body-s font-medium text-text hover:text-anchor focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                {p.title}
                <ExternalLink className="ms-1 inline size-3.5 align-baseline text-faint group-hover:text-anchor" aria-hidden />
              </a>
            ) : (
              <span className="text-body-s font-medium text-text">{p.title}</span>
            )}
            {p.journal || p.year ? (
              <p className="mt-1 text-body-s text-faint">
                {[p.journal, p.year].filter(Boolean).join(' · ')}
              </p>
            ) : null}
          </li>
        ))}
      </ul>
      {hidden > 0 ? (
        <button
          type="button"
          onClick={() => setShowAll((v) => !v)}
          className="mt-3 text-body-s font-medium text-anchor hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          {showAll ? 'Show fewer' : `Show all ${publications.length}`}
        </button>
      ) : null}
    </>
  );

  if (variant === 'card') {
    return (
      <article className="card p-6" aria-labelledby="kol-publications">
        <h2 id="kol-publications" className="display text-body-m text-text">Publications</h2>
        {list}
      </article>
    );
  }
  return (
    <section aria-labelledby="kol-publications">
      <h2 id="kol-publications" className="display text-body-l text-text">Publications</h2>
      {list}
    </section>
  );
}
