/** YouTube Shorts can be up to 3 minutes (since Oct 2024). */
export const YOUTUBE_SHORTS_MAX_SECONDS = 180;

/** Full podcast episodes on CHM channels are typically 20+ minutes. */
export const PODCAST_MIN_EPISODE_SECONDS = 15 * 60;

const SHORTS_MARKER = /#shorts\b|youtube\.com\/shorts\//i;

export function parseYouTubeDurationSeconds(iso: string | undefined | null): number {
  if (!iso) return 0;
  const match = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(iso);
  if (!match) return 0;
  const hours = parseInt(match[1] || '0', 10);
  const minutes = parseInt(match[2] || '0', 10);
  const seconds = parseInt(match[3] || '0', 10);
  return hours * 3600 + minutes * 60 + seconds;
}

export function isLikelyYouTubeShort(input: {
  title?: string;
  description?: string;
  tags?: string[];
  duration?: string;
}): boolean {
  const title = input.title ?? '';
  const description = input.description ?? '';
  if (SHORTS_MARKER.test(title) || SHORTS_MARKER.test(description)) return true;
  if (
    input.tags?.some((tag) => SHORTS_MARKER.test(tag) || /^shorts$/i.test(tag.trim()))
  ) {
    return true;
  }
  const secs = parseYouTubeDurationSeconds(input.duration);
  return secs > 0 && secs <= YOUTUBE_SHORTS_MAX_SECONDS;
}

export function isPodcastEpisodeVideo(input: {
  title?: string;
  description?: string;
  tags?: string[];
  duration?: string;
  minDurationSeconds?: number;
}): boolean {
  if (isLikelyYouTubeShort(input)) return false;
  const minSeconds = input.minDurationSeconds ?? PODCAST_MIN_EPISODE_SECONDS;
  const secs = parseYouTubeDurationSeconds(input.duration);
  return secs >= minSeconds;
}
