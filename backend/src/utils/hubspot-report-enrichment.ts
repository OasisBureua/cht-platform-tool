/**
 * Merge HubSpot campaign analytics snapshot (stored on Hub campaign as
 * hubspotRawData) into a Content Hub analytics report payload.
 */

type JsonRecord = Record<string, unknown>;

function asRecord(value: unknown): JsonRecord | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as JsonRecord)
    : null;
}

function pickMetric(
  metrics: unknown,
  keys: string[],
): string | number | null {
  const root = asRecord(metrics);
  if (!root) return null;
  for (const key of keys) {
    const v = root[key];
    if (typeof v === 'number' && Number.isFinite(v)) return v;
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  // Nested common HubSpot marketing metrics shapes
  for (const nestKey of ['totals', 'aggregate', 'summary', 'metrics']) {
    const nested = asRecord(root[nestKey]);
    if (!nested) continue;
    for (const key of keys) {
      const v = nested[key];
      if (typeof v === 'number' && Number.isFinite(v)) return v;
      if (typeof v === 'string' && v.trim()) return v.trim();
    }
  }
  return null;
}

function fmt(value: string | number | null): string {
  if (value == null) return '-';
  if (typeof value === 'number') return value.toLocaleString('en-US');
  return value;
}

export type HubspotReportEnrichment = {
  hubspotData: unknown;
  sectionsPatch: {
    hubspotOverview: unknown;
    landingPageAnalytics: { source: string; available: boolean; note: string };
    hcpEngagement: { source: string; available: boolean; note: string };
    funnelConversion: { available: boolean; note: string };
    emailPerformance: { available: boolean; note: string; summary?: unknown };
  };
  kpiUpdates: Array<{ label: string; value: string; source: string; note: string }>;
  dataGapsToRemove: RegExp[];
};

/**
 * Build enrichment fields from a campaign-analytics HubSpot snapshot.
 * Returns null when there is nothing useful to merge.
 */
export function buildHubspotReportEnrichment(
  hubspotRawData: unknown,
  hubspotSyncedAt?: string | null,
): HubspotReportEnrichment | null {
  const raw = asRecord(hubspotRawData);
  if (!raw) return null;

  const phase = typeof raw.phase === 'string' ? raw.phase : null;
  const hasPayload =
    raw.campaign != null ||
    raw.metrics != null ||
    raw.emailStatistics != null ||
    raw.assets != null;
  if (!hasPayload && phase !== 'campaign-analytics') {
    return null;
  }

  const syncedAt =
    (typeof raw.syncedAt === 'string' && raw.syncedAt) ||
    hubspotSyncedAt ||
    null;
  const portalId =
    raw.portalId != null ? String(raw.portalId) : null;
  const accountName =
    typeof raw.accountName === 'string' ? raw.accountName : null;
  const campaignId =
    typeof raw.hubspotCampaignId === 'string' ? raw.hubspotCampaignId : '';

  const contacts =
    pickMetric(raw.metrics, [
      'contacts',
      'numContacts',
      'contactCount',
      'sessions',
    ]) ??
    pickMetric(raw.campaign, ['numIncluded', 'hs_object_id']);
  const submissions = pickMetric(raw.metrics, [
    'formSubmissions',
    'submissions',
    'numSubmissions',
  ]);
  const emailSent = pickMetric(raw.emailStatistics, [
    'sent',
    'emailsSent',
    'delivered',
  ]);
  const emailOpen = pickMetric(raw.emailStatistics, [
    'open',
    'opens',
    'uniqueOpens',
  ]);

  const overview = {
    phase: phase ?? 'campaign-analytics',
    syncedAt,
    portalId,
    accountName,
    hubspotCampaignId: campaignId || null,
    campaign: raw.campaign ?? null,
    metrics: raw.metrics ?? null,
    assets: raw.assets ?? null,
    emailStatistics: raw.emailStatistics ?? null,
    warnings: Array.isArray(raw.warnings) ? raw.warnings : [],
    errors: Array.isArray(raw.errors) ? raw.errors : [],
  };

  const availableNote = syncedAt
    ? `Synced from HubSpot ${syncedAt}`
    : 'HubSpot campaign analytics snapshot';

  return {
    hubspotData: overview,
    sectionsPatch: {
      hubspotOverview: overview,
      landingPageAnalytics: {
        source: 'hubspot',
        available: Boolean(raw.campaign || raw.metrics),
        note: availableNote,
      },
      hcpEngagement: {
        source: 'hubspot',
        available: Boolean(raw.metrics || raw.campaign),
        note: availableNote,
      },
      funnelConversion: {
        available: Boolean(raw.metrics),
        note: availableNote,
      },
      emailPerformance: {
        available: Boolean(raw.emailStatistics),
        note: raw.emailStatistics
          ? availableNote
          : 'Email statistics unavailable for this reporting period.',
        summary: raw.emailStatistics ?? undefined,
      },
    },
    kpiUpdates: [
      {
        label: 'HubSpot Contacts',
        value: fmt(contacts),
        source: contacts != null ? 'hubspot' : 'unavailable',
        note:
          contacts != null
            ? availableNote
            : campaignId
              ? 'HubSpot synced; contact count not in metrics payload'
              : 'Set HubSpot Campaign ID and Sync Now',
      },
      {
        label: 'Form Submissions',
        value: fmt(submissions),
        source: submissions != null ? 'hubspot' : 'unavailable',
        note:
          submissions != null
            ? availableNote
            : 'Form submission counts depend on HubSpot campaign metrics scopes',
      },
      {
        label: 'Emails Sent',
        value: fmt(emailSent),
        source: emailSent != null ? 'hubspot' : 'unavailable',
        note:
          emailSent != null
            ? availableNote
            : 'Requires reporting period dates for email statistics',
      },
      {
        label: 'Email Opens',
        value: fmt(emailOpen),
        source: emailOpen != null ? 'hubspot' : 'unavailable',
        note:
          emailOpen != null
            ? availableNote
            : 'Requires reporting period dates for email statistics',
      },
    ],
    dataGapsToRemove: [
      /HubSpot not connected/i,
      /Connect HubSpot/i,
    ],
  };
}

/**
 * Deep-merge HubSpot enrichment into an analytics report object from Content Hub.
 */
export function enrichAnalyticsReportWithHubspot(
  report: unknown,
  hubspotRawData: unknown,
  hubspotSyncedAt?: string | null,
): unknown {
  const enrichment = buildHubspotReportEnrichment(
    hubspotRawData,
    hubspotSyncedAt,
  );
  if (!enrichment) return report;

  const base = asRecord(report) ?? {};
  const sections = asRecord(base.sections) ?? {};
  const kpiTiles = Array.isArray(sections.kpiTiles)
    ? [...sections.kpiTiles]
    : [];

  for (const update of enrichment.kpiUpdates) {
    const idx = kpiTiles.findIndex(
      (tile) =>
        asRecord(tile)?.label === update.label ||
        (typeof asRecord(tile)?.label === 'string' &&
          String(asRecord(tile)?.label).toLowerCase() ===
            update.label.toLowerCase()),
    );
    if (idx >= 0) {
      kpiTiles[idx] = { ...(asRecord(kpiTiles[idx]) ?? {}), ...update };
    } else {
      kpiTiles.push(update);
    }
  }

  const gaps = Array.isArray(sections.dataGaps)
    ? sections.dataGaps.filter(
        (g) =>
          typeof g !== 'string' ||
          !enrichment.dataGapsToRemove.some((re) => re.test(g)),
      )
    : [];

  return {
    ...base,
    hubspotData: enrichment.hubspotData,
    sections: {
      ...sections,
      ...enrichment.sectionsPatch,
      kpiTiles,
      dataGaps: gaps,
    },
  };
}
