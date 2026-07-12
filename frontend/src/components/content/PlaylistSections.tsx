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
 * WordPress-style browse sections (KOL Playlists / ASCO 2026) using CHT playlist cards.
 * KOL is shown as a flat grid (no section chrome); ASCO keeps a labeled section when present.
 */
export function PlaylistSections({ playlists, isInApp }: PlaylistSectionsProps) {
  const sections = groupPlaylistsIntoWpSections(playlists);

  if (sections.length === 0) return null;

  return (
    <div className="space-y-10">
      {sections.map((section) => {
        const showHeading = section.id !== 'kol';
        return (
          <section
            key={section.id}
            className="space-y-4"
            aria-labelledby={showHeading ? `playlist-section-${section.id}` : undefined}
            aria-label={showHeading ? undefined : section.label}
          >
            {showHeading ? (
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
            ) : null}
            <PlaylistGrid
              playlists={section.items}
              isInApp={isInApp}
              titleForItem={(item) => playlistDisplayTitle(item.title ?? '')}
              descriptionForItem={playlistCardDescription}
            />
          </section>
        );
      })}
    </div>
  );
}
