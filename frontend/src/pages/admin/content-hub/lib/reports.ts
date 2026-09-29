// Report builders: ported from the standalone app's server/reports.ts.
// Browser-safe: the Node getDb() bits are removed; uploads + hubspot-connected
// state are passed in as function arguments (see store.ts for the caller).
// Empty-data shapes match the captured fixtures exactly (docs/research/api-*.json).

import type {
  AnalyticsReport,
  Campaign,
  DataValidation,
  StoredCsvUpload,
} from './types';
import type { SurveyResponseAnalytics } from '../../../../api/admin';

const PLATFORM_LABEL: Record<string, string> = {
  linkedin: 'LinkedIn',
  meta: 'Meta',
  youtube: 'YouTube',
  livestream: 'Livestream',
  survey: 'Survey',
};

const SOURCE_METRICS: Record<string, string[]> = {
  HubSpot: ['Contacts', 'Form submissions', 'Landing page analytics', 'Email performance', 'HCP tracking', 'Funnel stages'],
  LinkedIn: ['Impressions', 'Video views', 'Dwell time', 'Completion rate'],
  Meta: ['Impressions', 'Reach', 'CTR', 'Demographics'],
  YouTube: ['Views', 'Watch time', 'CTR', 'Avg view duration'],
  Livestream: ['Event attendance', 'HCP verification', 'Watch time'],
  Survey: ['HCP survey responses', 'Practice-change intent', 'Barrier data'],
};

const GLOSSARY = [
  { term: 'Impressions', definition: 'Total number of times content was displayed to users. Each display counts as one impression.', platform: 'All' },
  { term: 'Reach', definition: 'Number of unique individuals who saw the content at least once during the reporting period.', platform: 'Meta' },
  { term: 'Video Views', definition: 'LinkedIn: views of 2+ continuous seconds with 50%+ visibility. YouTube: any initiated view. Meta: any video play.', platform: 'LinkedIn / YouTube / Meta' },
  { term: 'Engaged Views', definition: 'YouTube: views where the viewer interacted meaningfully (watched a threshold % or took action).', platform: 'YouTube' },
  { term: 'Video View Rate (VVR)', definition: 'Percentage of video plays resulting in a qualifying view. Calculated as Video Views ÷ Video Plays.', platform: 'LinkedIn' },
  { term: 'Average Dwell Time', definition: "Average time (seconds) a user's attention hovered over the ad unit. Longer = stronger content relevance.", platform: 'LinkedIn' },
  { term: 'Average View Duration', definition: 'Average seconds each viewer watched a YouTube video (Total Watch Time ÷ Total Views).', platform: 'YouTube' },
  { term: 'Watch Time', definition: 'Total cumulative hours all viewers spent watching YouTube content.', platform: 'YouTube' },
  { term: 'CTR (Click-Through Rate)', definition: 'Percentage of impressions resulting in a click. Calculated as Clicks ÷ Impressions.', platform: 'All' },
  { term: 'Link Clicks', definition: 'Number of clicks on a link directing users to the destination URL.', platform: 'Meta' },
  { term: 'Landing Page Views (LPV)', definition: 'Number of times the destination landing page loaded after a click.', platform: 'Meta / HubSpot' },
  { term: 'Completion Rate', definition: 'LinkedIn: percentage of video plays resulting in 100% view completion.', platform: 'LinkedIn' },
  { term: 'Form Submissions', definition: 'Number of times users completed and submitted a HubSpot-tracked form.', platform: 'HubSpot' },
  { term: 'Lifecycle Stage', definition: 'HubSpot property tracking where a contact is in the marketing/sales funnel.', platform: 'HubSpot' },
  { term: 'Registrations', definition: 'Individuals who registered for a live event or educational program.', platform: 'HubSpot / Livestream' },
  { term: 'Attendance Rate', definition: 'Percentage of registered individuals who attended the live event (Attendees ÷ Registrations).', platform: 'Livestream' },
  { term: 'Verified HCP Attendance', definition: 'Percentage of live event attendees confirmed as healthcare professionals via NPI data.', platform: 'Livestream' },
  { term: 'NPI (National Provider Identifier)', definition: 'Unique 10-digit US healthcare provider ID. Used to verify HCP contacts in campaign data.', platform: 'HubSpot' },
  { term: 'Practice-Change Intent', definition: 'Survey metric: percentage of HCPs indicating content will influence their clinical practice or prescribing decisions.', platform: 'Survey' },
];

function num(v: unknown): number {
  const n = typeof v === 'string' ? parseFloat(v.replace(/[,%]/g, '')) : Number(v);
  return isNaN(n) ? 0 : n;
}

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function sumColumn(rows: Array<Record<string, string>>, candidates: string[]): number {
  if (!rows?.length) return 0;
  const keys = Object.keys(rows[0] ?? {});
  const key = keys.find((k) => candidates.some((c) => k.toLowerCase().includes(c)));
  if (!key) return 0;
  return rows.reduce((acc, r) => acc + num(r[key]), 0);
}

function buildSurveyHighlights(upload: StoredCsvUpload | undefined): string[] {
  if (
    upload?.metadata?.source !== 'cht-feedback-survey' ||
    !upload.metadata.analytics ||
    typeof upload.metadata.analytics !== 'object'
  ) {
    return [];
  }
  const analytics = upload.metadata.analytics as SurveyResponseAnalytics;
  const highlights = [
    `${analytics.totals.totalResponses.toLocaleString()} post-event feedback responses were collected.`,
  ];

  for (const question of analytics.questions.slice(0, 4)) {
    if (question.kind === 'choice') {
      const top = [...question.options].sort((a, b) => b.count - a.count)[0];
      if (top) {
        highlights.push(
          `${question.prompt}: ${top.label} was the leading response (${top.percentage.toFixed(0)}%).`,
        );
      }
    } else if (question.kind === 'rating' && question.mean !== null) {
      highlights.push(
        `${question.prompt}: average rating ${question.mean.toFixed(1)} across ${question.count} responses.`,
      );
    } else if (question.kind === 'text' && question.responseCount > 0) {
      highlights.push(
        `${question.prompt}: ${question.responseCount} qualitative responses were submitted.`,
      );
    }
  }
  return highlights;
}

export function buildDataValidation(
  campaign: Campaign,
  uploads: StoredCsvUpload[],
  connected: boolean,
): DataValidation {
  const bySource = (label: string) => uploads.find((u) => PLATFORM_LABEL[u.platform] === label);

  const dataSourcesSummary = Object.entries(SOURCE_METRICS).map(([source, metrics]) => {
    if (source === 'HubSpot') {
      return {
        source,
        status: connected ? 'available' : 'missing',
        metricsAvailable: connected ? metrics : [],
        metricsMissing: connected ? [] : metrics,
        lastUpdated: campaign.hubspotSyncedAt ?? null,
      };
    }
    const upload = bySource(source);
    return {
      source,
      status: upload ? 'available' : 'missing',
      metricsAvailable: upload ? metrics : [],
      metricsMissing: upload ? [] : metrics,
      lastUpdated: upload?.uploadedAt ?? null,
    };
  }) as DataValidation['dataSourcesSummary'];

  return {
    hubspotConnected: connected,
    hubspotSyncedAt: campaign.hubspotSyncedAt ?? null,
    dataSourcesSummary,
  };
}

export function buildAnalyticsReport(
  campaign: Campaign,
  uploads: StoredCsvUpload[],
  connected: boolean,
): AnalyticsReport {
  const byPlatform = (p: string) => uploads.find((u) => u.platform === p);

  const li = byPlatform('linkedin');
  const me = byPlatform('meta');
  const yt = byPlatform('youtube');
  const ls = byPlatform('livestream');
  const sv = byPlatform('survey');
  const surveyHighlights = buildSurveyHighlights(sv);

  const liImpr = li ? sumColumn(li.rows, ['impression']) : 0;
  const meImpr = me ? sumColumn(me.rows, ['impression']) : 0;
  const ytViews = yt ? sumColumn(yt.rows, ['view']) : 0;
  const totalImpressions = liImpr + meImpr;

  const hasAnyData = uploads.length > 0 || connected || Boolean(campaign.hubspotRawData);

  const hs = (campaign.hubspotRawData ?? null) as Record<string, unknown> | null;
  const hsMetrics = (hs?.metrics && typeof hs.metrics === 'object'
    ? (hs.metrics as Record<string, unknown>)
    : null);
  const hsEmail = (hs?.emailStatistics && typeof hs.emailStatistics === 'object'
    ? (hs.emailStatistics as Record<string, unknown>)
    : null);
  const hsContacts = hsMetrics?.contacts ?? hsMetrics?.numContacts ?? null;
  const hsForms = hsMetrics?.formSubmissions ?? hsMetrics?.submissions ?? null;
  const hsSynced = Boolean(hs) || Boolean(campaign.hubspotSyncedAt);

  const kpiTiles = [
    { label: 'Total Impressions', value: totalImpressions ? fmt(totalImpressions) : '-', source: totalImpressions ? 'csv' : 'unavailable', note: totalImpressions ? 'LinkedIn + Meta CSV' : 'Upload platform CSVs' },
    {
      label: 'HubSpot Contacts',
      value: hsContacts != null ? fmt(Number(hsContacts) || 0) : '-',
      source: hsContacts != null ? 'hubspot' : 'unavailable',
      note: hsSynced ? (campaign.hubspotSyncedAt ? `Synced ${campaign.hubspotSyncedAt}` : 'HubSpot snapshot') : 'Connect HubSpot and Sync Now',
    },
    {
      label: 'Form Submissions',
      value: hsForms != null ? fmt(Number(hsForms) || 0) : '-',
      source: hsForms != null ? 'hubspot' : 'unavailable',
      note: hsSynced ? 'HubSpot campaign metrics' : 'Connect HubSpot',
    },
    { label: 'LinkedIn Video Views', value: li ? fmt(sumColumn(li.rows, ['video view', 'views'])) : '-', source: li ? 'csv' : 'unavailable', note: li ? li.filename : 'Upload LinkedIn CSV' },
    { label: 'Meta CTR', value: '-', source: me ? 'csv' : 'unavailable', note: me ? me.filename : 'Upload Meta CSV' },
    { label: 'Meta Link Clicks', value: me ? fmt(sumColumn(me.rows, ['click'])) : '-', source: me ? 'csv' : 'unavailable', note: me ? me.filename : 'Upload Meta CSV' },
    { label: 'YouTube Total Views', value: yt ? fmt(ytViews) : '-', source: yt ? 'csv' : 'unavailable', note: yt ? yt.filename : 'Upload YouTube CSV' },
    { label: 'YouTube Watch Time', value: yt ? fmt(sumColumn(yt.rows, ['watch'])) : '-', source: yt ? 'csv' : 'unavailable', note: yt ? yt.filename : 'Upload YouTube CSV' },
    { label: 'Live Attendees', value: ls ? fmt(sumColumn(ls.rows, ['attend'])) : '-', source: ls ? 'csv' : 'unavailable', note: ls ? ls.filename : 'Upload Livestream CSV' },
    { label: 'Survey Responses', value: sv ? fmt(sv.rows?.length ?? 0) : '-', source: sv ? 'cht survey' : 'unavailable', note: sv ? sv.filename : 'Select CHT feedback survey' },
  ];

  const dataGaps: string[] = [];
  if (!connected && !hsSynced) dataGaps.push('HubSpot not connected: contact activity, form submissions, landing page analytics, email performance, HCP lifecycle stage, and funnel data are unavailable.');
  if (!li) dataGaps.push('LinkedIn performance data not uploaded: video views, dwell time, completion rates, and creative-level CTR are unavailable.');
  if (!me) dataGaps.push('Meta performance data not uploaded: regional breakdowns, audience demographics, and CTR benchmarking are unavailable.');
  if (!yt) dataGaps.push('YouTube performance data not uploaded: video-level views, engaged views, and watch time are unavailable.');
  if (!ls) dataGaps.push('Livestream/event attendance data not uploaded: registrations, live attendance, HCP verification rate are unavailable.');
  if (!sv) dataGaps.push('No CHT post-event feedback survey selected: practice-change intent, confidence lift, and qualitative HCP insights are unavailable.');

  const executiveSummary = hasAnyData
    ? `The ${campaign.name} campaign delivered across ${(campaign.platforms ?? []).join(', ')} during the reporting period ${campaign.reportingPeriodStart} – ${campaign.reportingPeriodEnd}. This report summarizes aggregate performance, channel breakdowns, and strategic recommendations based on the connected data sources.`
    : `The ${campaign.name} campaign report is configured for data entry. Connect HubSpot and upload platform CSV exports to generate a full performance summary. Platforms: ${(campaign.platforms ?? []).join(', ')}.`;

  const hubspotOverview = hsSynced
    ? {
        phase: hs?.phase ?? 'campaign-analytics',
        syncedAt: campaign.hubspotSyncedAt ?? hs?.syncedAt ?? null,
        portalId: hs?.portalId ?? null,
        accountName: hs?.accountName ?? null,
        hubspotCampaignId: hs?.hubspotCampaignId ?? campaign.hubspotCampaignId ?? null,
        campaign: hs?.campaign ?? null,
        metrics: hs?.metrics ?? null,
        emailStatistics: hs?.emailStatistics ?? null,
        warnings: hs?.warnings ?? [],
        errors: hs?.errors ?? [],
      }
    : null;

  return {
    campaign,
    generatedAt: new Date().toISOString(),
    hubspotData: hubspotOverview,
    csvData: uploads.map((u) => ({ platform: u.platform, filename: u.filename, rowCount: u.rows?.length ?? 0 })),
    sections: {
      executiveSummary,
      crossChannelSnapshot: { rows: [] },
      kpiTiles,
      hubspotOverview,
      landingPageAnalytics: {
        source: 'hubspot',
        available: hsSynced,
        note: hsSynced
          ? 'HubSpot campaign analytics snapshot'
          : 'Connect HubSpot to access landing page analytics.',
      },
      hcpEngagement: {
        source: 'hubspot',
        available: hsSynced,
        note: hsSynced
          ? 'HubSpot campaign analytics snapshot'
          : 'Connect HubSpot for HCP contact-level data and NPI tracking.',
      },
      funnelConversion: {
        available: hsSynced,
        note: hsSynced
          ? 'HubSpot campaign analytics snapshot'
          : 'Connect HubSpot for funnel stage and conversion tracking.',
      },
      emailPerformance: {
        available: Boolean(hsEmail),
        note: hsEmail
          ? 'HubSpot email statistics for reporting period'
          : 'Connect HubSpot and specify a HubSpot Campaign ID to pull email performance.',
      },
      linkedinData: li ? { filename: li.filename, rowCount: li.rows?.length ?? 0 } : null,
      metaData: me ? { filename: me.filename, rowCount: me.rows?.length ?? 0 } : null,
      youtubeData: yt ? { filename: yt.filename, rowCount: yt.rows?.length ?? 0 } : null,
      livestreamData: ls ? { filename: ls.filename, rowCount: ls.rows?.length ?? 0 } : null,
      surveyData: sv
        ? {
            source: sv.metadata?.source ?? 'upload',
            label: sv.filename,
            rowCount: sv.rows?.length ?? 0,
            surveyId: sv.metadata?.surveyId ?? null,
            analytics: sv.metadata?.analytics ?? null,
          }
        : null,
      topContent: [],
      keyHighlights: surveyHighlights,
      recommendations: [
        'Replicate highest-performing content formats and physician pairings in future campaign flights.',
        'Allocate additional budget to regions and audience segments demonstrating above-average CTR.',
        'Review the selected post-event feedback survey for practice-change intent and content impact.',
        'Ensure all HubSpot forms are tagged with campaign identifiers for accurate attribution.',
        'Connect HubSpot to enable contact-level tracking, form attribution, and email performance analytics.',
        'Export LinkedIn Campaign Manager data after each flight for dwell time and completion rate analysis.',
        'Export Meta Ads Manager regional and demographic breakdowns for geographic optimization insights.',
      ],
      dataGaps,
      glossary: GLOSSARY,
      aiInsights: campaign.aiInsights ?? null,
    },
    dataValidation: buildDataValidation(campaign, uploads, connected || hsSynced),
  };
}
