/**
 * Clip URL helpers for catalog + deep links.
 *
 * - Short clip ID: `official:youtube:E1tTwDQgMBc` → `E1tTwDQgMBc`; other ids → `encodeURIComponent`.
 * - Playback: we only embed YouTube (`YouTubePlayer`). Use `extractYoutubeVideoIdFromUrl` / `shouldSurfaceCatalogClip`
 *   so grids do not link to blank players.
 */
export function extractYoutubeVideoIdFromUrl(url: string | undefined | null): string | null {
  if (url == null || typeof url !== 'string' || !url.trim()) return null;
  const m = url.trim().match(/(?:v=|\/)([a-zA-Z0-9_-]{11})(?:\?|&|$)/);
  return m ? m[1] : null;
}

export function getShortClipId(id: string | undefined | null): string {
  if (id == null || typeof id !== 'string') return '';
  const match = id.match(/:([a-zA-Z0-9_-]{11})$/);
  if (match) return match[1];
  return encodeURIComponent(id);
}

/** LinkedIn-hosted catalog clips are not supported in our player — omit from listings and deep links. */
export function isLinkedinCatalogClipId(id: string | undefined | null): boolean {
  if (id == null || typeof id !== 'string') return false;
  let decoded = id;
  try {
    decoded = decodeURIComponent(id);
  } catch {
    /* ignore */
  }
  const lower = decoded.toLowerCase();
  return lower.includes('linkedin') || lower.includes('urn:li:');
}

function catalogYoutubeUrlString(clip: { youtube_url?: string; youtubeUrl?: string }): string {
  const u = clip.youtube_url ?? clip.youtubeUrl;
  return typeof u === 'string' ? u : '';
}

/** Thumbnail for MediaHub clip cards (matches Catalog / Videos / Explore). */
export function getMediaHubThumbnail(clip: { thumbnail_url?: string; youtube_url?: string; youtubeUrl?: string }): string {
  if (clip.thumbnail_url) return clip.thumbnail_url;
  const id = extractYoutubeVideoIdFromUrl(catalogYoutubeUrlString(clip));
  if (id) return `https://img.youtube.com/vi/${id}/hqdefault.jpg`;
  return '/images/placeholder-playlist.svg';
}

/** True when the API gave a poster or we can derive one from a playable YouTube URL. */
export function hasRealThumbnail(clip: { thumbnail_url?: string; youtube_url?: string; youtubeUrl?: string }): boolean {
  if (clip.thumbnail_url?.trim()) return true;
  return extractYoutubeVideoIdFromUrl(catalogYoutubeUrlString(clip)) != null;
}

/**
 * Show in grids / search only if the in-app clip page can play the video (YouTube embed) and the id is not a known-bad source.
 * Clips with only a third-party thumb or non-YouTube URLs used to link to a blank / empty player.
 */
export function shouldSurfaceCatalogClip(clip: {
  id: string;
  thumbnail_url?: string;
  youtube_url?: string;
  youtubeUrl?: string;
}): boolean {
  if (isLinkedinCatalogClipId(clip.id)) return false;
  return extractYoutubeVideoIdFromUrl(catalogYoutubeUrlString(clip)) != null;
}
