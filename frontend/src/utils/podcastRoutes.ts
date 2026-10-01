/** In-app podcast URL helpers (mirrors public `/podcast-network`). */
import { PODCAST_NETWORK_APP_BASE } from './site-paths';

export function podcastShowPath(showId: string): string {
  return `${PODCAST_NETWORK_APP_BASE}/${encodeURIComponent(showId)}`;
}

export function podcastEpisodeWatchPath(showId: string, episodeId: string): string {
  return `${PODCAST_NETWORK_APP_BASE}/${encodeURIComponent(showId)}/watch/${encodeURIComponent(episodeId)}`;
}

/**
 * YouTube episode titles repeat the show ("The Breast Friends Podcast
 * Ep. 9 | Humanizing Cancer Care"); anywhere the show is already named,
 * show only the part after the bar.
 */
export function episodeDisplayTitle(title: string): string {
  const parts = title.split('|');
  if (parts.length > 1 && /ep\.?\s*\d+/i.test(parts[0])) return parts.slice(1).join('|').trim();
  return title;
}
