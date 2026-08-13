/** Normalized counters extracted from HubSpot campaign + asset payloads. */
export type CampaignMetricTotals = {
  sessions: number;
  influencedContacts: number;
  newContactsFirstTouch: number;
  newContactsLastTouch: number;
  emailSent: number;
  emailOpens: number;
  emailClicks: number;
  landingPageViews: number;
  formSubmissions: number;
  socialClicks: number;
  marketingEventRegistrations: number;
};

export const EMPTY_CAMPAIGN_METRIC_TOTALS: CampaignMetricTotals = {
  sessions: 0,
  influencedContacts: 0,
  newContactsFirstTouch: 0,
  newContactsLastTouch: 0,
  emailSent: 0,
  emailOpens: 0,
  emailClicks: 0,
  landingPageViews: 0,
  formSubmissions: 0,
  socialClicks: 0,
  marketingEventRegistrations: 0,
};

const METRIC_KEY_MAP: Record<string, keyof CampaignMetricTotals> = {
  sessions: 'sessions',
  influencedcontacts: 'influencedContacts',
  newcontactsfirsttouch: 'newContactsFirstTouch',
  newcontactslasttouch: 'newContactsLastTouch',
  sent: 'emailSent',
  open: 'emailOpens',
  opens: 'emailOpens',
  clicks: 'emailClicks',
  click: 'emailClicks',
  views: 'landingPageViews',
  submissions: 'formSubmissions',
  registrations: 'marketingEventRegistrations',
  facebook_clicks: 'socialClicks',
  linkedin_clicks: 'socialClicks',
  twitter_clicks: 'socialClicks',
};

function toNumber(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function normalizeMetricKey(key: string): string {
  return key.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
}

function addToTotals(
  totals: CampaignMetricTotals,
  key: string,
  value: unknown,
): void {
  const mapped = METRIC_KEY_MAP[normalizeMetricKey(key)];
  if (!mapped) return;
  totals[mapped] += toNumber(value);
}

/** Walk arbitrary HubSpot JSON and accumulate known metric counters. */
export function accumulateMetricsFromUnknown(
  raw: unknown,
  totals: CampaignMetricTotals = { ...EMPTY_CAMPAIGN_METRIC_TOTALS },
): CampaignMetricTotals {
  if (raw == null) return totals;

  if (Array.isArray(raw)) {
    for (const item of raw) {
      accumulateMetricsFromUnknown(item, totals);
    }
    return totals;
  }

  if (typeof raw !== 'object') return totals;

  const record = raw as Record<string, unknown>;

  for (const [key, value] of Object.entries(record)) {
    if (key === 'metrics' && value && typeof value === 'object') {
      for (const [metricKey, metricValue] of Object.entries(
        value as Record<string, unknown>,
      )) {
        addToTotals(totals, metricKey, metricValue);
      }
      continue;
    }

    if (
      typeof value === 'number' ||
      (typeof value === 'string' && /^-?\d+(\.\d+)?$/.test(value.trim()))
    ) {
      addToTotals(totals, key, value);
      continue;
    }

    if (value && typeof value === 'object') {
      accumulateMetricsFromUnknown(value, totals);
    }
  }

  return totals;
}

export function mergeMetricTotals(
  ...partials: Array<Partial<CampaignMetricTotals> | CampaignMetricTotals>
): CampaignMetricTotals {
  const merged = { ...EMPTY_CAMPAIGN_METRIC_TOTALS };
  for (const partial of partials) {
    for (const key of Object.keys(merged) as Array<keyof CampaignMetricTotals>) {
      merged[key] += partial[key] ?? 0;
    }
  }
  return merged;
}

export type HubSpotCampaignListItem = {
  id: string;
  name: string;
  status: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

export function parseHubSpotCampaignList(raw: unknown): {
  items: HubSpotCampaignListItem[];
  after: string | null;
} {
  const record =
    raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const results = Array.isArray(record.results) ? record.results : [];
  const paging =
    record.paging && typeof record.paging === 'object'
      ? (record.paging as Record<string, unknown>)
      : null;
  const next =
    paging?.next && typeof paging.next === 'object'
      ? (paging.next as Record<string, unknown>)
      : null;
  const after =
    typeof next?.after === 'string' && next.after.trim()
      ? next.after.trim()
      : null;

  const items = results
    .map((entry) => {
      if (!entry || typeof entry !== 'object') return null;
      const row = entry as Record<string, unknown>;
      const id = typeof row.id === 'string' ? row.id.trim() : '';
      if (!id) return null;

      const properties =
        row.properties && typeof row.properties === 'object'
          ? (row.properties as Record<string, unknown>)
          : {};

      const name =
        (typeof properties.hs_name === 'string' && properties.hs_name.trim()) ||
        (typeof row.name === 'string' && row.name.trim()) ||
        `Campaign ${id.slice(0, 8)}`;

      const status =
        typeof properties.hs_campaign_status === 'string'
          ? properties.hs_campaign_status
          : typeof properties.status === 'string'
            ? properties.status
            : null;

      return {
        id,
        name,
        status,
        createdAt:
          typeof properties.hs_createdate === 'string'
            ? properties.hs_createdate
            : null,
        updatedAt:
          typeof properties.hs_lastmodifieddate === 'string'
            ? properties.hs_lastmodifieddate
            : null,
      } satisfies HubSpotCampaignListItem;
    })
    .filter((item): item is HubSpotCampaignListItem => item != null);

  return { items, after };
}

export function campaignNameFromDetail(raw: unknown, fallbackId: string): string {
  if (!raw || typeof raw !== 'object') return `Campaign ${fallbackId.slice(0, 8)}`;
  const record = raw as Record<string, unknown>;
  const properties =
    record.properties && typeof record.properties === 'object'
      ? (record.properties as Record<string, unknown>)
      : record;

  const name =
    (typeof properties.hs_name === 'string' && properties.hs_name.trim()) ||
    (typeof record.name === 'string' && record.name.trim());
  return name || `Campaign ${fallbackId.slice(0, 8)}`;
}

export type HubSpotSocialPost = {
  id: string;
  name: string;
  network: string | null;
  facebookClicks: number;
  linkedinClicks: number;
  twitterClicks: number;
  totalClicks: number;
};

function toFiniteNumber(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function inferSocialNetwork(
  name: string,
  metrics: Record<string, unknown>,
): string | null {
  const lower = name.toLowerCase();
  if (lower.includes('linkedin')) return 'LinkedIn';
  if (lower.includes('facebook') || lower.includes('instagram')) {
    return lower.includes('instagram') ? 'Instagram' : 'Facebook';
  }
  if (lower.includes('twitter') || lower.includes(' x ')) return 'X';
  if (toFiniteNumber(metrics.LINKEDIN_CLICKS) > 0) return 'LinkedIn';
  if (toFiniteNumber(metrics.FACEBOOK_CLICKS) > 0) return 'Facebook';
  if (toFiniteNumber(metrics.TWITTER_CLICKS) > 0) return 'X';
  return null;
}

/** Parse HubSpot SOCIAL_BROADCAST campaign assets into social posts. */
export function parseSocialPostsFromAssets(raw: unknown): HubSpotSocialPost[] {
  if (!raw || typeof raw !== 'object') return [];
  const record = raw as Record<string, unknown>;
  const results = Array.isArray(record.results) ? record.results : [];

  return results
    .map((entry) => {
      if (!entry || typeof entry !== 'object') return null;
      const row = entry as Record<string, unknown>;
      const id = typeof row.id === 'string' ? row.id.trim() : '';
      if (!id) return null;
      const metrics =
        row.metrics && typeof row.metrics === 'object'
          ? (row.metrics as Record<string, unknown>)
          : {};
      const name =
        (typeof row.name === 'string' && row.name.trim()) || `Social post ${id}`;
      const facebookClicks = toFiniteNumber(metrics.FACEBOOK_CLICKS);
      const linkedinClicks = toFiniteNumber(metrics.LINKEDIN_CLICKS);
      const twitterClicks = toFiniteNumber(metrics.TWITTER_CLICKS);

      return {
        id,
        name,
        network: inferSocialNetwork(name, metrics),
        facebookClicks,
        linkedinClicks,
        twitterClicks,
        totalClicks: facebookClicks + linkedinClicks + twitterClicks,
      } satisfies HubSpotSocialPost;
    })
    .filter((item): item is HubSpotSocialPost => item != null);
}

export function countAssetsByType(
  assetsByType: Record<string, unknown | null>,
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const [assetType, payload] of Object.entries(assetsByType)) {
    if (!payload || typeof payload !== 'object') {
      counts[assetType] = 0;
      continue;
    }
    const record = payload as Record<string, unknown>;
    const results = Array.isArray(record.results) ? record.results : [];
    counts[assetType] = results.length;
  }
  return counts;
}

/** Parse a stored HubSpot analytics snapshot (hubspotRawData) into dashboard metrics. */
export function metricsFromHubspotSnapshot(raw: unknown): {
  metrics: CampaignMetricTotals;
  assetCounts: Record<string, number>;
  socialPosts: HubSpotSocialPost[];
} {
  if (!raw || typeof raw !== 'object') {
    return {
      metrics: { ...EMPTY_CAMPAIGN_METRIC_TOTALS },
      assetCounts: {},
      socialPosts: [],
    };
  }

  const snap = raw as Record<string, unknown>;
  const metrics = mergeMetricTotals(
    accumulateMetricsFromUnknown(snap.metrics),
    accumulateMetricsFromUnknown(snap.campaign),
    accumulateMetricsFromUnknown(snap.assets),
    accumulateMetricsFromUnknown(snap.emailStatistics),
  );

  const assetsByType: Record<string, unknown | null> = {};
  if (snap.assets && typeof snap.assets === 'object') {
    assetsByType.MARKETING_EMAIL = snap.assets;
  }
  const extraAssets =
    snap.assetsByType && typeof snap.assetsByType === 'object'
      ? (snap.assetsByType as Record<string, unknown | null>)
      : {};
  const socialRaw = extraAssets.SOCIAL_BROADCAST ?? snap.socialPosts ?? null;

  return {
    metrics,
    assetCounts: countAssetsByType({ ...assetsByType, ...extraAssets }),
    socialPosts: parseSocialPostsFromAssets(socialRaw),
  };
}

export function hasAnyMetricData(metrics: CampaignMetricTotals): boolean {
  return Object.values(metrics).some((value) => value > 0);
}
