/**
 * Extract short clip ID for clean URLs.
 * MediaHub IDs: official:youtube:E1tTwDQgMBc -> E1tTwDQgMBc
 */
export function getShortClipId(id: string | undefined | null): string {
  if (id == null || typeof id !== 'string') return '';
  const match = id.match(/:([a-zA-Z0-9_-]{11})$/);
  if (match) return match[1];
  return id;
}

/** Thumbnail for MediaHub clip cards (matches Catalog / Videos / Explore). */
export function getMediaHubThumbnail(clip: { thumbnail_url?: string; youtube_url?: string }): string {
  if (clip.thumbnail_url) return clip.thumbnail_url;
  const m = clip.youtube_url?.match(/(?:v=|\/)([a-zA-Z0-9_-]{11})(?:\?|&|$)/);
  if (m) return `https://img.youtube.com/vi/${m[1]}/hqdefault.jpg`;
  return 'https://via.placeholder.com/400x260?text=Video';
}
