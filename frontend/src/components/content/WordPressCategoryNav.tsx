import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { catalogApi } from '../../api/catalog';
import {
  formatWordPressCategoryLabel,
  sortWordPressCategories,
  useWordPressCatalog,
  WORDPRESS_CATALOG_STALE_MS,
} from '../../utils/wordpressCatalog';

type WordPressCategoryNavProps = {
  basePath: string;
  activeSlug?: string;
};

/**
 * Browse by category.
 *
 * All 42 categories used to render as one flat row, which is a wall
 * rather than a filter. They are also not one list: alongside disease
 * and stage there are drugs, trials, congresses, a `p-` prefixed mirror
 * of the clinical set (an audience axis, not nine topics), and internal
 * workflow tags — `uncategorized` alone is the third largest.
 *
 * So the row shows the clinical categories only, and everything else
 * moves behind one control with a count. Fixing the taxonomy itself is
 * a CMS job; this stops the page being a wall today, without it.
 */

/** Editorial and workflow state, never a thing to browse by. */
const INTERNAL = /^(uncategorized|new-|hp-|featured-|.*-feature$|chm-articles|chm-podcast-network)/;

/** The `p-` mirror of a clinical category: audience, not topic. */
const PATIENT_MIRROR = /^p[-\s]/;

/** What a clinician actually browses: disease, stage, setting. */
const CLINICAL = new Set([
  'mbc', 'ebc', 'hr', 'her2', 'high-risk-cns', 'triple-negative',
  'her2-low-ultra-low', 'intermediate-stage', 'locoregional',
  'peri-operative', 'resectable',
]);

export function WordPressCategoryNav({ basePath, activeSlug }: WordPressCategoryNavProps) {
  const wpMode = useWordPressCatalog();
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const { data } = useQuery({
    queryKey: ['catalog', 'wordpress', 'categories'],
    queryFn: catalogApi.getWordPressCategories,
    staleTime: WORDPRESS_CATALOG_STALE_MS,
    enabled: wpMode,
  });

  // Escape closes and returns focus to the control that opened it.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    const onClick = (e: MouseEvent) => {
      if (
        panelRef.current &&
        !panelRef.current.contains(e.target as Node) &&
        !triggerRef.current?.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onClick);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onClick);
    };
  }, [open]);

  if (!wpMode || !data?.items?.length) return null;

  const all = sortWordPressCategories(data.items).filter((c) => !INTERNAL.test(c.slug));
  if (all.length === 0) return null;

  const primary = all.filter((c) => CLINICAL.has(c.slug));
  const rest = all.filter((c) => !CLINICAL.has(c.slug));

  // The mirror is an audience, so it groups on its own rather than
  // sitting among the drugs and trials.
  const patient = rest.filter((c) => PATIENT_MIRROR.test(c.slug));
  const other = rest.filter((c) => !PATIENT_MIRROR.test(c.slug));

  const chip = (active: boolean) =>
    [
      'press inline-flex h-8 shrink-0 items-center gap-1.5 rounded-[6px] px-3 text-[0.8125rem]',
      'transition-[background-color,color] duration-150',
      'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-anchor',
      active ? 'bg-inverse text-ground' : 'bg-surface text-dim hover:bg-surface-2 hover:text-text',
    ].join(' ');

  const Chip = ({ slug, count }: { slug: string; count: number }) => (
    <Link to={`${basePath}/catalog/${slug}`} className={chip(activeSlug === slug)}>
      {formatWordPressCategoryLabel(slug)}
      <span className="meta tabular-nums opacity-60">{count}</span>
    </Link>
  );

  return (
    <div className="relative">
      <nav className="flex flex-wrap items-center gap-2" aria-label="Browse by category">
        {primary.map((c) => (
          <Chip key={c.slug} slug={c.slug} count={c.post_count} />
        ))}

        {rest.length > 0 && (
          <button
            ref={triggerRef}
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls="category-more"
            className={chip(open)}
          >
            All filters
            <span className="meta tabular-nums opacity-60">{rest.length}</span>
          </button>
        )}
      </nav>

      {open && (
        <div
          ref={panelRef}
          id="category-more"
          className="absolute z-30 mt-2 w-full max-w-[42rem] rounded-card bg-surface p-5 shadow-[var(--shadow-pop)]"
        >
          {other.length > 0 && (
            <div>
              <p className="eyebrow text-faint">Drugs, trials and congresses</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {other.map((c) => (
                  <Chip key={c.slug} slug={c.slug} count={c.post_count} />
                ))}
              </div>
            </div>
          )}

          {patient.length > 0 && (
            <div className={other.length > 0 ? 'mt-6' : ''}>
              <p className="eyebrow text-faint">Written for patients</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {patient.map((c) => (
                  <Chip key={c.slug} slug={c.slug} count={c.post_count} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
