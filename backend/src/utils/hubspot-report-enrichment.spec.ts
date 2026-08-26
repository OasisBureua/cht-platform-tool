import {
  buildHubspotReportEnrichment,
  enrichAnalyticsReportWithHubspot,
} from './hubspot-report-enrichment';

describe('hubspot-report-enrichment', () => {
  const snapshot = {
    phase: 'campaign-analytics',
    syncedAt: '2026-07-28T12:00:00.000Z',
    portalId: '51136698',
    accountName: 'HubSpot portal 51136698',
    hubspotCampaignId: 'abc',
    campaign: { id: 'abc', name: 'Test' },
    metrics: { contacts: 120, formSubmissions: 45 },
    emailStatistics: { sent: 1000, open: 250 },
    assets: null,
    warnings: [],
    errors: [],
  };

  it('builds enrichment from campaign-analytics snapshot', () => {
    const e = buildHubspotReportEnrichment(snapshot);
    expect(e).not.toBeNull();
    expect(e!.sectionsPatch.hubspotOverview).toMatchObject({
      portalId: '51136698',
      hubspotCampaignId: 'abc',
    });
    expect(e!.kpiUpdates.find((k) => k.label === 'HubSpot Contacts')?.value).toBe(
      '120',
    );
  });

  it('merges into an existing report payload', () => {
    const report = {
      generatedAt: '2026-07-28T12:00:00.000Z',
      hubspotData: null,
      sections: {
        kpiTiles: [
          {
            label: 'HubSpot Contacts',
            value: '-',
            source: 'unavailable',
            note: 'Connect HubSpot',
          },
        ],
        hubspotOverview: null,
        dataGaps: ['HubSpot not connected: contact activity unavailable.'],
      },
    };
    const enriched = enrichAnalyticsReportWithHubspot(
      report,
      snapshot,
    ) as {
      hubspotData: unknown;
      sections: { kpiTiles: Array<{ value: string }>; dataGaps: string[] };
    };
    expect(enriched.hubspotData).toBeTruthy();
    expect(enriched.sections.kpiTiles[0].value).toBe('120');
    expect(enriched.sections.dataGaps).toHaveLength(0);
  });

  it('returns report unchanged when no hubspot snapshot', () => {
    const report = { sections: { kpiTiles: [] } };
    expect(enrichAnalyticsReportWithHubspot(report, null)).toBe(report);
  });
});
