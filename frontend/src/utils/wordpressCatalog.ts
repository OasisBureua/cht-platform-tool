import type { MediaHubClip, WordPressCategoryItem } from '../api/catalog';

/** Client-side cache for WordPress catalog reads (matches backend 4h upstream cache). */
export const WORDPRESS_CATALOG_STALE_MS = 4 * 60 * 60 * 1000;

export function useWordPressCatalog(): boolean {
  const flag = import.meta.env.VITE_CATALOG_WORDPRESS_ONLY;
  if (flag === 'true' || flag === '1') return true;
  if (flag === 'false' || flag === '0') return false;
  return import.meta.env.DEV;
}

export function clipHasWordPressCategory(
  clip: MediaHubClip,
  categorySlug: string,
): boolean {
  const slug = categorySlug.trim().toLowerCase();
  if (!slug) return false;
  return (clip.wordpress?.categories ?? []).some(
    (c) => c.trim().toLowerCase() === slug,
  );
}

export function formatWordPressCategoryLabel(slug: string): string {
  const known: Record<string, string> = {
    her2: 'HER2+',
    mbc: 'mBC',
    hr: 'HR+',
    ebc: 'eBC',
    'high-risk-cns': 'High-Risk / CNS',
    'p-her2': 'P-HER2+',
    'p-hr': 'P-HR+',
    'p-high-risk-cns': 'P-High-Risk / CNS',
    'asco-2026': 'ASCO 2026',
    enhertu: 'Enhertu',
  };
  const key = slug.trim().toLowerCase();
  if (known[key]) return known[key];
  return slug
    .split('-')
    .map((w) => (w.length <= 3 ? w.toUpperCase() : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(' ');
}

export function formatWordPressSeriesLabel(seriesSlug: string): string {
  return seriesSlug
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' / ');
}

export function sortWordPressCategories(
  items: WordPressCategoryItem[],
): WordPressCategoryItem[] {
  return [...items].sort((a, b) => {
    if (b.post_count !== a.post_count) return b.post_count - a.post_count;
    return a.slug.localeCompare(b.slug);
  });
}
