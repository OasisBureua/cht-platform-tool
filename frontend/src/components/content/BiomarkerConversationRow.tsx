import { useQuery } from '@tanstack/react-query';
import { catalogApi, type MediaHubClip } from '../../api/catalog';
import { shouldSurfaceCatalogClip } from '../../utils/clipUrl';
import {
  type CarouselConfig,
  HCP_CAROUSELS,
} from '../../data/carousels.config';
import { ConversationRow, StripCard, StripRowLoading } from '../home/ConversationRow';
import {
  VIEW_PLAYLIST_LABEL,
  buildCatalogSectionPlaylistsHref,
} from '../../utils/playlistFocusFilters';

/**
 * A single themed clip row driven by `carousels.config.ts`.
 *
 * Each row's behavior is declared in the config — tag filter, sort
 * dimension, dedup, per-shoot cap, page size, platform. This component
 * just executes the contract.
 *
 * Replaces the older `filterPlaylistsByFocus` + flatten-playlist-videos
 * approach (audit fixes #1, #2, #3, #5, #7 in
 * .claude/audits/2026-05-16-cht-video-audit.md). The brittle
 * `_generated-catalog-playlists.json` fuzzy-title-match is gone — every
 * card is now an on-topic clip pulled from MediaHub by tag.
 *
 * Behavior states:
 * - loading → skeleton strip
 * - clips returned → one `StripCard` per clip, linking to clip detail
 * - empty → renders nothing (no zero-state for top-level dashboard rows)
 */
export function BiomarkerConversationRow({
  carouselId,
  isInApp,
  hideBrokenCatalogThumbnails = false,
}: {
  /** Identifier matching a row in `carousels.config.ts`. */
  carouselId: string;
  isInApp: boolean;
  /** When true (e.g. app dashboard home), omit tiles whose poster fails to load. */
  hideBrokenCatalogThumbnails?: boolean;
}) {
  const config: CarouselConfig | undefined = HCP_CAROUSELS.find(
    (c) => c.id === carouselId,
  );

  if (!config) {
    // Misconfigured carouselId — render nothing rather than blow up. Bug
    // surfaces in dev via the carousels.config.test.ts unit tests.
    return null;
  }

  const { data, isLoading } = useQuery({
    queryKey: [
      'catalog',
      'clips',
      'carousel',
      config.id,
      config.tag,
      config.sort_by,
      config.dedup_by,
      config.per_shoot_cap,
      config.limit,
      config.platform,
    ],
    queryFn: () =>
      catalogApi.getClips({
        tag: config.tag,
        sort_by: config.sort_by,
        dedup_by: config.dedup_by,
        per_shoot_cap: config.per_shoot_cap,
        limit: config.limit,
        platform: config.platform,
      }),
    staleTime: 5 * 60 * 1000,
  });

  const clips: MediaHubClip[] = (data?.items ?? []).filter(
    shouldSurfaceCatalogClip,
  );

  const seeAllHref = buildCatalogSectionPlaylistsHref(isInApp, config.label);

  if (isLoading) {
    return (
      <ConversationRow
        title={config.label}
        seeAllHref={seeAllHref}
        seeAllLabel={VIEW_PLAYLIST_LABEL}
      >
        <StripRowLoading />
      </ConversationRow>
    );
  }

  if (clips.length === 0) return null;

  const subtitle = `${clips.length} video${clips.length !== 1 ? 's' : ''}`;

  return (
    <ConversationRow
      title={config.label}
      subtitle={subtitle}
      seeAllHref={seeAllHref}
      seeAllLabel={VIEW_PLAYLIST_LABEL}
    >
      {clips.map((c) => (
        <StripCard
          key={c.id}
          hideThumbnailOnError={hideBrokenCatalogThumbnails}
          to={
            isInApp ? `/app/catalog/clip/${c.id}` : `/catalog/clip/${c.id}`
          }
          title={c.title}
          imageUrl={
            c.thumbnail_url ||
            // ID is `official:youtube:<videoId>`; extract the YouTube ID for the fallback poster.
            (c.id.startsWith('official:youtube:')
              ? `https://img.youtube.com/vi/${c.id.split(':').slice(2).join(':')}/hqdefault.jpg`
              : '')
          }
          description={
            c.doctors && c.doctors.length > 0
              ? c.doctors.slice(0, 2).join(' · ')
              : c.shoot_name || ''
          }
        />
      ))}
    </ConversationRow>
  );
}

/**
 * Convenience re-export: the biomarker-row config rows from
 * `carousels.config.ts`. Lets call-sites map over a stable list without
 * re-importing the config module everywhere.
 *
 * The previous `BIOMARKER_ROWS` constant exported `{label, focus}` pairs.
 * It's been replaced by `BIOMARKER_CAROUSEL_IDS` — call sites now pass
 * a `carouselId` (string) which the row component resolves through the
 * config.
 */
export const BIOMARKER_CAROUSEL_IDS: string[] = HCP_CAROUSELS.filter((c) =>
  c.id.startsWith('hcp-home-') && c.id !== 'hcp-home-recently-added',
).map((c) => c.id);
