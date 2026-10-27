/**
 * Legacy HubSpot Social Media API (broadcast/v1) helpers for CPR-56.
 * Soft-enrich SOCIAL_BROADCAST asset ids with channel / URL / publish time.
 * The API is deprecated but still the only public path for those fields.
 */

import type { HubSpotSocialPost } from './hubspot-campaign-metrics.util';

/** Optional private-app scope for GET /broadcast/v1/broadcasts/{id}. */
export const HUBSPOT_SOCIAL_BROADCAST_SCOPE = 'social';

export type HubSpotBroadcastEnrichment = {
  contentUrl: string | null;
  publishedAt: string | null;
  channelKey: string | null;
  broadcastStatus: string | null;
  network: string | null;
  message: string | null;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : null;
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function msToIso(value: unknown): string | null {
  const n =
    typeof value === 'number'
      ? value
      : typeof value === 'string' && value.trim()
        ? Number(value)
        : NaN;
  if (!Number.isFinite(n) || n <= 0) return null;
  const ms = n < 1e12 ? n * 1000 : n;
  const d = new Date(ms);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export function networkFromChannelKey(channelKey: string | null): string | null {
  if (!channelKey) return null;
  const lower = channelKey.toLowerCase();
  if (lower.startsWith('linkedin')) return 'LinkedIn';
  if (lower.startsWith('instagram')) return 'Instagram';
  if (lower.startsWith('facebook')) return 'Facebook';
  if (lower.startsWith('twitter') || lower.startsWith('x-') || lower === 'x') {
    return 'X';
  }
  return null;
}

function contentUrlFromBroadcast(content: Record<string, unknown> | null): string | null {
  if (!content) return null;
  return (
    asString(content.originalLink) ||
    asString(content.link) ||
    asString(content.photoUrl) ||
    asString(content.thumbnailUrl) ||
    asString(content.url) ||
    null
  );
}

/** Normalize a legacy broadcast payload into enrich fields. */
export function parseBroadcastEnrichment(
  raw: unknown,
): HubSpotBroadcastEnrichment | null {
  const row = asRecord(raw);
  if (!row) return null;

  const channelKey =
    asString(row.channelKey) || asString(row.channelGuid) || null;
  const content = asRecord(row.content);
  const message =
    asString(row.message) ||
    asString(content?.body) ||
    asString(content?.message) ||
    asString(content?.text) ||
    null;

  return {
    contentUrl: contentUrlFromBroadcast(content),
    publishedAt: msToIso(row.finishedAt) ?? msToIso(row.triggerAt),
    channelKey,
    broadcastStatus: asString(row.status),
    network: networkFromChannelKey(channelKey),
    message,
  };
}

/** Merge broadcast enrich fields onto a SOCIAL_BROADCAST-derived post. */
export function applyBroadcastEnrichment(
  post: HubSpotSocialPost,
  enrichment: HubSpotBroadcastEnrichment,
): HubSpotSocialPost {
  return {
    ...post,
    network: enrichment.network ?? post.network,
    name:
      enrichment.message && enrichment.message.length <= 500
        ? enrichment.message
        : post.name,
    contentUrl: enrichment.contentUrl,
    publishedAt: enrichment.publishedAt,
    channelKey: enrichment.channelKey,
    broadcastStatus: enrichment.broadcastStatus,
  };
}
