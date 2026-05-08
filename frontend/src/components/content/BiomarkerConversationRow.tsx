import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { catalogApi } from '../../api/catalog';
import {
  filterPlaylistsByFocus,
  type PlaylistFocus,
  VIEW_PLAYLIST_LABEL,
} from '../../utils/playlistFocusFilters';
import { useFlattenedPlaylistVideos } from '../../hooks/useFlattenedPlaylistVideos';
import { ConversationRow, StripCard, StripRowLoading } from '../home/ConversationRow';

const ROW_VIDEO_CAP = 40;

export const BIOMARKER_ROWS: { label: string; focus: PlaylistFocus }[] = [
  { label: 'HER2+ Conversations',       focus: 'her2'      },
  { label: 'HER2-Low / Ultra-Low',      focus: 'her2-low'  },
  { label: 'HR+ · CDK4/6 · Endocrine',  focus: 'hr'        },
  { label: 'TNBC & Triple Negative',    focus: 'tnbc'       },
  { label: 'High Risk Breast Cancer',   focus: 'high-risk'  },
];

/**
 * A single themed playlist row.
 *
 * Reads the shared `['catalog', 'playlists']` React Query cache (no extra network
 * request when the parent has already fetched it), narrows to the relevant focus
 * group via `filterPlaylistsByFocus`, then hydrates individual videos through
 * `useFlattenedPlaylistVideos`.
 *
 * - While loading → skeleton strip
 * - Videos available → one `StripCard` per video, linking to the playlist page
 * - No videos but playlists present → one `StripCard` per playlist (fallback)
 * - Nothing at all → renders nothing
 */
export function BiomarkerConversationRow({
  label,
  focus,
  isInApp,
}: {
  label: string;
  focus: PlaylistFocus;
  isInApp: boolean;
}) {
  const { data: playlists = [] } = useQuery({
    queryKey: ['catalog', 'playlists'],
    queryFn: catalogApi.getPlaylists,
    staleTime: 10 * 60 * 1000,
  });

  const filteredPlaylists = useMemo(
    () => filterPlaylistsByFocus(playlists, focus),
    [playlists, focus],
  );

  const playlistIds = useMemo(
    () => filteredPlaylists.map((p) => p.id),
    [filteredPlaylists],
  );

  const { entries, isLoading } = useFlattenedPlaylistVideos(playlistIds, playlistIds.length > 0);

  const seeAllHref = isInApp
    ? `/app/catalog?view=playlists&playlistFocus=${encodeURIComponent(focus)}`
    : `/catalog?view=playlists&playlistFocus=${encodeURIComponent(focus)}`;

  const subtitle = entries.length > 0
    ? `${entries.length} video${entries.length !== 1 ? 's' : ''}`
    : filteredPlaylists.length > 0
      ? `${filteredPlaylists.length} playlist${filteredPlaylists.length !== 1 ? 's' : ''}`
      : undefined;

  if (isLoading && playlistIds.length > 0) {
    return (
      <ConversationRow title={label} seeAllHref={seeAllHref} seeAllLabel={VIEW_PLAYLIST_LABEL}>
        <StripRowLoading />
      </ConversationRow>
    );
  }

  if (entries.length === 0 && filteredPlaylists.length === 0) return null;

  if (entries.length === 0) {
    return (
      <ConversationRow title={label} subtitle={subtitle} seeAllHref={seeAllHref} seeAllLabel={VIEW_PLAYLIST_LABEL}>
        {filteredPlaylists.map((p) => (
          <StripCard
            key={p.id}
            to={isInApp ? `/app/catalog/playlist/${p.id}` : `/catalog/playlist/${p.id}`}
            title={p.title}
            imageUrl={p.thumbnailUrl || `https://img.youtube.com/vi/${p.id}/hqdefault.jpg`}
            description={
              p.videoCount != null && p.videoCount > 0
                ? `${p.videoCount} video${p.videoCount !== 1 ? 's' : ''}`
                : p.videoNames?.slice(0, 3).join(' • ') || 'Playlist'
            }
          />
        ))}
      </ConversationRow>
    );
  }

  return (
    <ConversationRow title={label} subtitle={subtitle} seeAllHref={seeAllHref} seeAllLabel={VIEW_PLAYLIST_LABEL}>
      {entries.slice(0, ROW_VIDEO_CAP).map((e) => (
        <StripCard
          key={`${e.playlistId}-${e.video.id}`}
          to={
            isInApp
              ? `/app/catalog/playlist/${encodeURIComponent(e.playlistId)}?v=${encodeURIComponent(e.video.id)}`
              : `/catalog/playlist/${encodeURIComponent(e.playlistId)}?v=${encodeURIComponent(e.video.id)}`
          }
          title={e.video.title}
          imageUrl={e.video.thumbnailUrl || `https://img.youtube.com/vi/${e.video.id}/hqdefault.jpg`}
          description={e.playlistTitle}
        />
      ))}
    </ConversationRow>
  );
}
