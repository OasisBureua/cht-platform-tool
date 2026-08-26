import { useQuery } from '@tanstack/react-query';
import { catalogApi, type CatalogItem } from '../../api/catalog';
import {
  groupPlaylistsIntoWpSections,
  playlistCardDescription,
  playlistDisplayTitle,
} from '../../utils/playlistWpSections';
import { WORDPRESS_CATALOG_STALE_MS } from '../../utils/wordpressCatalog';
import { PlaylistGrid } from './PlaylistGrid';

type PlaylistSectionsProps = {
  playlists: CatalogItem[];
  isInApp: boolean;
};

/**
 * WordPress-style browse sections by topic (HER2+, HR+, TNBC/ADC, ASCO, …).
 *
 * SCRUM-81: prefers the curator-set tag overlay for classification;
 * title-regex classifier is the fallback for untagged playlists.
 */
export function PlaylistSections({ playlists, isInApp }: PlaylistSectionsProps) {
  const { data: overlayData } = useQuery({
    queryKey: ['catalog', 'playlists-tags', 'all-for-sections'],
    queryFn: () => catalogApi.getPlaylistsTags({ limit: 200 }),
    staleTime: WORDPRESS_CATALOG_STALE_MS,
  });

  const sections = groupPlaylistsIntoWpSections(playlists, overlayData?.items);

  if (sections.length === 0) return null;

  return (
    <div className="space-y-10">
      {sections.map((section) => (
        <section
          key={section.id}
          className="space-y-4"
          aria-labelledby={`playlist-section-${section.id}`}
        >
          <div className="min-w-0 space-y-1 border-b border-gray-100 pb-3 dark:border-zinc-800">
            <h3
              id={`playlist-section-${section.id}`}
              className="text-lg font-bold tracking-tight text-foreground sm:text-xl"
            >
              {section.label}
            </h3>
            <p className="text-sm text-muted-foreground">
              {section.items.length} playlist{section.items.length !== 1 ? 's' : ''}
            </p>
          </div>
          <PlaylistGrid
            playlists={section.items}
            isInApp={isInApp}
            titleForItem={(item) => playlistDisplayTitle(item.title ?? '')}
            descriptionForItem={playlistCardDescription}
          />
        </section>
      ))}
    </div>
  );
}
