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
