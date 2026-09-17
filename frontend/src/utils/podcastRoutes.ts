/** In-app podcast URL helpers (mirrors public `/podcast-network`). */
import { PODCAST_NETWORK_APP_BASE } from './site-paths';

export function podcastShowPath(showId: string): string {
  return `${PODCAST_NETWORK_APP_BASE}/${encodeURIComponent(showId)}`;
}

export function podcastEpisodeWatchPath(showId: string, episodeId: string): string {
  return `${PODCAST_NETWORK_APP_BASE}/${encodeURIComponent(showId)}/watch/${encodeURIComponent(episodeId)}`;
}
