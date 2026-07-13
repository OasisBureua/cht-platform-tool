import type { CatalogItem } from '../../api/catalog';
import {
  groupPlaylistsIntoWpSections,
  playlistCardDescription,
  playlistDisplayTitle,
} from '../../utils/playlistWpSections';
import { PlaylistGrid } from './PlaylistGrid';

type PlaylistSectionsProps = {
  playlists: CatalogItem[];
  isInApp: boolean;
};

/**
 * WordPress-style browse sections by topic (HER2+, HR+, TNBC/ADC, ASCO, …).
 */
export function PlaylistSections({ playlists, isInApp }: PlaylistSectionsProps) {
  const sections = groupPlaylistsIntoWpSections(playlists);

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
              className="text-lg font-bold tracking-tight text-gray-900 dark:text-zinc-100 sm:text-xl"
            >
              {section.label}
            </h3>
            <p className="text-sm text-gray-600 dark:text-zinc-400">
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
