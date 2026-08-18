/**
 * GA4 video analytics via dataLayer (GTM).
 * Events are pushed to dataLayer; GTM sends them to GA4 measurement ID G-EXVD5CJLQL.
 */

declare global {
  interface Window {
    dataLayer?: Array<Record<string, unknown>>;
  }
}

export type VideoEventName = 'video_start' | 'video_progress' | 'video_complete';

export function pushVideoEvent(
  event: VideoEventName,
  params: { video_id: string; video_title: string; progress_percent?: number }
): void {
  if (typeof window === 'undefined') return;
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({
    event,
    video_id: params.video_id,
    video_title: params.video_title,
    ...(params.progress_percent != null && { progress_percent: params.progress_percent }),
  });
}

export type ClipSurface = 'clip_detail' | 'playlist_detail';
export type ShareChannel = 'facebook' | 'linkedin' | 'copy' | 'email';

export function pushClipView(params: {
  clip_id: string;
  clip_title: string;
  surface: ClipSurface;
  playlist_id?: string;
}): void {
  if (typeof window === 'undefined') return;
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({
    event: 'clip_view',
    clip_id: params.clip_id,
    clip_title: params.clip_title,
    surface: params.surface,
    ...(params.playlist_id && { playlist_id: params.playlist_id }),
  });
}

export function pushClipShareClick(params: {
  clip_id: string;
  clip_title: string;
  channel: ShareChannel;
  surface: string;
}): void {
  if (typeof window === 'undefined') return;
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({
    event: 'clip_share_click',
    clip_id: params.clip_id,
    clip_title: params.clip_title,
    channel: params.channel,
    surface: params.surface,
  });
}

export function pushKolPlaylistClick(params: {
  kol_id: string;
  playlist_id: string;
  playlist_title: string;
}): void {
  if (typeof window === 'undefined') return;
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({
    event: 'kol_playlist_click',
    kol_id: params.kol_id,
    playlist_id: params.playlist_id,
    playlist_title: params.playlist_title,
    surface: 'kol_profile_engagement',
  });
}

export function pushChapterClick(params: {
  clip_id: string;
  clip_title: string;
  chapter_index: number;
  chapter_title?: string;
  seek_seconds: number;
}): void {
  if (typeof window === 'undefined') return;
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({
    event: 'chapter_click',
    clip_id: params.clip_id,
    clip_title: params.clip_title,
    chapter_index: params.chapter_index,
    ...(params.chapter_title && { chapter_title: params.chapter_title }),
    seek_seconds: params.seek_seconds,
  });
}
