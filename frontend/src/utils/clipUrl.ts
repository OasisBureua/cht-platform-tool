/**
 * Clip URL helpers for catalog + deep links.
 *
 * - Short clip ID: `official:youtube:E1tTwDQgMBc` → `E1tTwDQgMBc`; other ids → `encodeURIComponent`.
 * - Playback: we only embed YouTube (`YouTubePlayer`). Use `extractYoutubeVideoIdFromUrl` / `shouldSurfaceCatalogClip`
 *   so grids do not link to blank players.
 */
export function extractYoutubeVideoIdFromUrl(url: string | undefined | null): string | null {
  if (url == null || typeof url !== 'string' || !url.trim()) return null;
  const m = url
    .trim()
    .match(/(?:v=|\/embed\/|\/shorts\/|youtu\.be\/)([a-zA-Z0-9_-]{11})(?:\?|&|$|\/)/);
  if (m) return m[1];
  const bare = url.trim().match(/^[a-zA-Z0-9_-]{11}$/);
  return bare ? bare[0] : null;
}

export function getShortClipId(id: string | undefined | null): string {
  if (id == null || typeof id !== 'string') return '';
  const match = id.match(/:([a-zA-Z0-9_-]{11})$/);
  if (match) return match[1];
  return encodeURIComponent(id);
}

/** LinkedIn-hosted catalog clips are not supported in our player, omit from listings and deep links. */
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

function catalogYoutubeUrlString(clip: { youtube_url?: string; youtubeUrl?: string; id?: string }): string {
  const u = clip.youtube_url ?? clip.youtubeUrl;
  if (typeof u === 'string' && u.trim()) return u;
  const short = getShortClipId(clip.id);
  if (short && /^[a-zA-Z0-9_-]{11}$/.test(short)) {
    return `https://www.youtube.com/watch?v=${short}`;
  }
  return '';
}

/** YouTube poster sizes we try when ContentHub sends a 404ing maxres URL. */
export const YOUTUBE_THUMB_FALLBACKS = ['hqdefault', 'sddefault', 'mqdefault', 'default'] as const;

export function youtubeThumbUrl(
  videoId: string,
  size: (typeof YOUTUBE_THUMB_FALLBACKS)[number] | 'maxresdefault' = 'hqdefault',
): string {
  return `https://i.ytimg.com/vi/${videoId}/${size}.jpg`;
}

/**
 * Prefer hqdefault over maxresdefault: YouTube often 404s maxres even for valid videos.
 */
export function normalizeCatalogThumbnailUrl(url: string | undefined | null, videoId?: string | null): string {
  const id =
    videoId ||
    (url ? url.match(/\/vi\/([a-zA-Z0-9_-]{11})\//)?.[1] : null) ||
    null;
  if (url?.trim()) {
    const u = url.trim();
    if (/\/maxresdefault\.jpg(?:\?|$)/i.test(u) && id) {
      return youtubeThumbUrl(id, 'hqdefault');
    }
    return u;
  }
  if (id) return youtubeThumbUrl(id, 'hqdefault');
  return '/images/placeholder-playlist.svg';
}

/** Next poster URL after a 404, or null when we should hide the card. */
export function nextCatalogThumbnailFallback(currentSrc: string, videoId: string | null): string | null {
  if (!videoId) return null;
  const sizes = ['maxresdefault', ...YOUTUBE_THUMB_FALLBACKS] as const;
  const match = currentSrc.match(/\/(maxresdefault|hqdefault|sddefault|mqdefault|default)\.jpg/i);
  const current = match?.[1]?.toLowerCase() ?? '';
  const idx = sizes.findIndex((s) => s === current);
  if (idx < 0) return youtubeThumbUrl(videoId, 'hqdefault');
  const next = sizes[idx + 1];
  if (!next) return null;
  return youtubeThumbUrl(videoId, next as (typeof YOUTUBE_THUMB_FALLBACKS)[number]);
}

/** Thumbnail for MediaHub clip cards (matches Catalog / Videos / Explore). */
export function getMediaHubThumbnail(clip: {
  id?: string;
  thumbnail_url?: string;
  youtube_url?: string;
  youtubeUrl?: string;
}): string {
  const videoId =
    extractYoutubeVideoIdFromUrl(catalogYoutubeUrlString(clip)) ||
    (clip.id ? getShortClipId(clip.id) : null);
  const id = videoId && /^[a-zA-Z0-9_-]{11}$/.test(videoId) ? videoId : null;
  return normalizeCatalogThumbnailUrl(clip.thumbnail_url, id);
}

/** True when the API gave a poster or we can derive one from a playable YouTube URL. */
export function hasRealThumbnail(clip: {
  thumbnail_url?: string;
  youtube_url?: string;
  youtubeUrl?: string;
  id?: string;
}): boolean {
  if (clip.thumbnail_url?.trim()) return true;
  return extractYoutubeVideoIdFromUrl(catalogYoutubeUrlString(clip)) != null;
}

/**
 * Show in grids / search only if the in-app clip page can play the video (YouTube embed) and the id is not a known-bad source.
 * Clips with only a third-party thumb or non-YouTube URLs used to link to a blank / empty player.
 */
export function shouldSurfaceCatalogClip(
  clip: {
    id: string;
    thumbnail_url?: string;
    youtube_url?: string;
    youtubeUrl?: string;
    wordpress?: { post_id?: number } | null;
  },
  options?: { requireWordPress?: boolean },
): boolean {
  if (isLinkedinCatalogClipId(clip.id)) return false;
  if (options?.requireWordPress && !clip.wordpress) return false;
  return extractYoutubeVideoIdFromUrl(catalogYoutubeUrlString(clip)) != null;
}
