import { useQuery } from '@tanstack/react-query';
import { catalogApi } from '../api/catalog';
import { extractYoutubeVideoIdFromUrl } from '../utils/clipUrl';

export type FlatPlaylistVideo = {
  video: { id: string; title: string; thumbnailUrl: string; youtubeUrl: string };
  playlistId: string;
  playlistTitle: string;
};

/**
 * Fetches each playlist detail and merges video lists (stable playlist order;
 * skips duplicate video ids — first playlist wins).
 */
export function useFlattenedPlaylistVideos(playlistIds: string[], enabled: boolean) {
  const keyJoined = playlistIds.join('|');

  const query = useQuery({
    queryKey: ['catalog', 'flattened-playlist-videos', keyJoined],
    queryFn: async (): Promise<FlatPlaylistVideo[]> => {
      if (playlistIds.length === 0) return [];
      const results = await Promise.all(playlistIds.map((id) => catalogApi.getPlaylist(id)));
      const out: FlatPlaylistVideo[] = [];
      const seen = new Set<string>();
      playlistIds.forEach((pid, i) => {
        const res = results[i];
        if (!res?.videos?.length) return;
        for (const v of res.videos) {
          if (!extractYoutubeVideoIdFromUrl(v.youtubeUrl)) continue;
          if (seen.has(v.id)) continue;
          seen.add(v.id);
          out.push({
            video: v,
            playlistId: pid,
            playlistTitle: res.playlist.title,
          });
        }
      });
      return out;
    },
    enabled: enabled && playlistIds.length > 0,
    staleTime: 5 * 60 * 1000,
  });

  return {
    entries: query.data ?? [],
    isLoading: query.isPending,
    isError: query.isError,
    error: query.error,
    playlistCount: playlistIds.length,
  };
}
