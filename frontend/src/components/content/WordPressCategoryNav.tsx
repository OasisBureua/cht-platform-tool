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

export function WordPressCategoryNav({ basePath, activeSlug }: WordPressCategoryNavProps) {
  const wpMode = useWordPressCatalog();

  const { data } = useQuery({
    queryKey: ['catalog', 'wordpress', 'categories'],
    queryFn: catalogApi.getWordPressCategories,
    staleTime: WORDPRESS_CATALOG_STALE_MS,
    enabled: wpMode,
  });

  if (!wpMode || !data?.items?.length) return null;

  const categories = sortWordPressCategories(data.items).filter(
    (c) => !c.slug.startsWith('hp-') && c.post_count > 0,
  );

  if (categories.length === 0) return null;

  return (
    <nav className="flex flex-wrap gap-2" aria-label="Browse by category">
      {categories.map((cat) => {
        const active = activeSlug === cat.slug;
        return (
          <Link
            key={cat.slug}
            to={`${basePath}/catalog/${cat.slug}`}
            className={[
              'rounded-full px-3 py-1.5 text-xs font-semibold transition-colors',
              active
                ? 'bg-gray-900 text-white'
                : 'bg-gray-100 text-gray-800 hover:bg-gray-200',
            ].join(' ')}
          >
            {formatWordPressCategoryLabel(cat.slug)}
            <span className="ml-1 tabular-nums opacity-70">({cat.post_count})</span>
          </Link>
        );
      })}
    </nav>
  );
}
