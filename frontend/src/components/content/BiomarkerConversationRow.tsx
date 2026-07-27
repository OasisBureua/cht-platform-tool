import { useQuery } from '@tanstack/react-query';
import { useCallback, useMemo, useState } from 'react';
import { catalogApi, type MediaHubClip } from '../../api/catalog';
import { getShortClipId, getMediaHubThumbnail, shouldSurfaceCatalogClip } from '../../utils/clipUrl';
import {
  type CarouselConfig,
  getCarousel,
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
 * Each row's behavior is declared in the config, tag filter, sort
 * dimension, dedup, per-shoot cap, page size, platform. This component
 * just executes the contract.
 *
 * Behavior states:
 * - loading → skeleton strip
 * - clips returned → one `StripCard` per clip, linking to clip detail
 * - empty / all posters broken → renders nothing
 */
export function BiomarkerConversationRow({
  carouselId,
  isInApp,
  /** When false, keep cards even if the poster fails (legacy). Default: hide broken posters. */
  hideBrokenCatalogThumbnails = true,
}: {
  /** Identifier matching a row in `carousels.config.ts`. */
  carouselId: string;
  isInApp: boolean;
  /** When true (default), omit tiles whose poster 404s or is YouTube's gray placeholder. */
  hideBrokenCatalogThumbnails?: boolean;
}) {
  const config: CarouselConfig | undefined = getCarousel(carouselId);
  const [brokenThumbIds, setBrokenThumbIds] = useState<Set<string>>(() => new Set());
  const markBroken = useCallback((id: string) => {
    setBrokenThumbIds((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }, []);

  const { data, isLoading } = useQuery({
    queryKey: [
      'catalog',
      'clips',
      'carousel',
      config?.id,
      config?.tag,
      config?.sort_by,
      config?.dedup_by,
      config?.per_shoot_cap,
      config?.limit,
      config?.platform,
    ],
    queryFn: () =>
      catalogApi.getClips({
        tag: config!.tag,
        sort_by: config!.sort_by,
        dedup_by: config!.dedup_by,
        per_shoot_cap: config!.per_shoot_cap,
        limit: config!.limit,
        platform: config!.platform,
      }),
    enabled: Boolean(config),
    staleTime: 5 * 60 * 1000,
  });

  const clips: MediaHubClip[] = useMemo(() => {
    const surfaced = (data?.items ?? []).filter(shouldSurfaceCatalogClip);
    if (!hideBrokenCatalogThumbnails || brokenThumbIds.size === 0) return surfaced;
    return surfaced.filter((c) => !brokenThumbIds.has(c.id));
  }, [data?.items, hideBrokenCatalogThumbnails, brokenThumbIds]);

  if (!config) {
    return null;
  }

  // Anon home uses short row titles (HER2+ / HR+); catalog browse uses section labels.
  const seeAllSectionById: Record<string, string> = {
    'anon-home-her2': 'HER2+ Conversations',
    'anon-home-hr': 'HR+ · CDK4/6 · Endocrine',
  };
  const seeAllHref = buildCatalogSectionPlaylistsHref(
    isInApp,
    seeAllSectionById[config.id] ?? config.label,
  );

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
          onThumbnailError={
            hideBrokenCatalogThumbnails ? () => markBroken(c.id) : undefined
          }
          to={
            isInApp
              ? `/app/clip/${getShortClipId(c.id)}`
              : `/catalog/clip/${getShortClipId(c.id)}`
          }
          title={c.title}
          imageUrl={getMediaHubThumbnail(c)}
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
 */
export const BIOMARKER_CAROUSEL_IDS: string[] = HCP_CAROUSELS.filter((c) =>
  c.id.startsWith('hcp-home-') && c.id !== 'hcp-home-recently-added',
).map((c) => c.id);

/** Public marketing home biomarker strips (catalog clips by tag, not YouTube playlists). */
export const ANON_HOME_BIOMARKER_CAROUSEL_IDS: string[] = [
  'anon-home-her2',
  'anon-home-hr',
];
