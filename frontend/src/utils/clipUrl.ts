/**
 * Extract short clip ID for clean URLs.
 *   YouTube:  official:youtube:E1tTwDQgMBc  → E1tTwDQgMBc  (11-char short code)
 *   Other:    official:linkedin:urn:li:...  → encodeURIComponent(id)
 *             (React Router decodes useParams automatically; catalogApi.getClip
 *              re-encodes for the backend request, so the round-trip is safe.)
 */
export function getShortClipId(id: string | undefined | null): string {
  if (id == null || typeof id !== 'string') return '';
  const match = id.match(/:([a-zA-Z0-9_-]{11})$/);
  if (match) return match[1];
  return encodeURIComponent(id);
}

/** Thumbnail for MediaHub clip cards (matches Catalog / Videos / Explore). */
export function getMediaHubThumbnail(clip: { thumbnail_url?: string; youtube_url?: string }): string {
  if (clip.thumbnail_url) return clip.thumbnail_url;
  const m = clip.youtube_url?.match(/(?:v=|\/)([a-zA-Z0-9_-]{11})(?:\?|&|$)/);
  if (m) return `https://img.youtube.com/vi/${m[1]}/hqdefault.jpg`;
  return '/images/placeholder-playlist.svg';
}

/** Returns true only when the clip has a real thumbnail (not the grey placeholder). */
export function hasRealThumbnail(clip: { thumbnail_url?: string; youtube_url?: string }): boolean {
  if (clip.thumbnail_url) return true;
  const m = clip.youtube_url?.match(/(?:v=|\/)([a-zA-Z0-9_-]{11})(?:\?|&|$)/);
  return !!m;
}
