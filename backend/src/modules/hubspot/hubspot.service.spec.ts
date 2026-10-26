import { ConfigService } from '@nestjs/config';
import { HubSpotService } from './hubspot.service';
import { metricsFromHubspotSnapshot } from './hubspot-campaign-metrics.util';

function jsonResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  };
}

describe('HubSpotService test-account guard', () => {
  const fetchMock = jest.fn();
  const realFetch = global.fetch;
  let service: HubSpotService;

  beforeEach(() => {
    fetchMock.mockReset();
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ results: [{ id: '1' }] }),
      text: async () => '{}',
    });
    global.fetch = fetchMock as unknown as typeof fetch;
    service = new HubSpotService(
      new ConfigService({
        hubspot: { accessToken: 'pat-na1-00000000-test-token-for-spec' },
      }),
    );
  });

  afterAll(() => {
    global.fetch = realFetch;
  });

  it('does not upsert a test-account contact', async () => {
    await service.createOrUpdateContact({
      email: 'success+cpr49-01@simulator.amazonses.com',
      firstname: 'Test',
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('does not record program activity for a test account', async () => {
    await service.recordProgramActivity({
      contact: { email: 'success+cpr49-02@simulator.amazonses.com' },
      programId: 'p-1',
      programTitle: '[TEST] Dry Run',
      registrationStatus: 'APPROVED',
      event: 'registration_approved',
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('still upserts a real contact', async () => {
    await service.createOrUpdateContact({
      email: 'dr.real@example-clinic.org',
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toContain(
      '/crm/v3/objects/contacts/batch/upsert',
    );
  });
});

describe('HubSpotService.getCampaignAnalytics (CPR-56 chunk 3)', () => {
  const fetchMock = jest.fn();
  const realFetch = global.fetch;
  let service: HubSpotService;
  const campaignId = '6169fb82-1c1d-448f-9a65-9a92bea0b1e9';

  beforeEach(() => {
    fetchMock.mockReset();
    global.fetch = fetchMock as unknown as typeof fetch;
    service = new HubSpotService(
      new ConfigService({
        hubspot: { accessToken: 'pat-na1-00000000-test-token-for-spec' },
      }),
    );

    fetchMock.mockImplementation(async (url: string) => {
      const path = String(url);

      if (path.includes('/integrations/v1/me')) {
        return jsonResponse({ portalId: 51136698, uiDomain: 'app.hubspot.com' });
      }

      if (path.includes(`/campaigns/${campaignId}/assets/SOCIAL_BROADCAST`)) {
        return jsonResponse({
          results: [
            {
              id: 'soc-1',
              name: 'LinkedIn post',
              metrics: {
                FACEBOOK_CLICKS: 0,
                LINKEDIN_CLICKS: 5,
                TWITTER_CLICKS: 0,
              },
            },
          ],
        });
      }

      if (path.includes(`/campaigns/${campaignId}/assets/LANDING_PAGE`)) {
        return jsonResponse({ status: 403, message: 'forbidden' }, 403);
      }

      if (path.includes(`/campaigns/${campaignId}/assets/`)) {
        return jsonResponse({ results: [] });
      }

      if (path.includes(`/campaigns/${campaignId}/reports/metrics`)) {
        return jsonResponse({ sessions: 10 });
      }

      if (
        path.includes(`/campaigns/${campaignId}`) &&
        !path.includes('/assets/')
      ) {
        return jsonResponse({
          id: campaignId,
          properties: { hs_name: 'DSI-26-01_DB09_PLS1' },
        });
      }

      if (path.includes('/marketing/v3/emails/statistics')) {
        return jsonResponse({ sent: 0 });
      }

      return jsonResponse({});
    });
  });

  afterAll(() => {
    global.fetch = realFetch;
  });

  it('includes assetsByType.SOCIAL_BROADCAST with startDate and endDate', async () => {
    const snapshot = await service.getCampaignAnalytics(
      {
        hubspotCampaignId: campaignId,
        reportingPeriodStart: '2026-07-01',
        reportingPeriodEnd: '2026-09-30',
      },
      { includeEmailStatistics: false },
    );

    expect(snapshot.assetsByType?.SOCIAL_BROADCAST).toMatchObject({
      results: [{ id: 'soc-1' }],
    });
    expect(snapshot.socialPosts).toHaveLength(1);
    expect(snapshot.socialPosts?.[0].totalClicks).toBe(5);

    const socialCalls = fetchMock.mock.calls
      .map((c: unknown[]) => String(c[0]))
      .filter((u: string) => u.includes('SOCIAL_BROADCAST'));
    expect(socialCalls.length).toBeGreaterThanOrEqual(1);
    expect(socialCalls[0]).toContain('startDate=2026-07-01');
    expect(socialCalls[0]).toContain('endDate=2026-09-30');
  });

  it('soft-fails one asset type without dropping SOCIAL_BROADCAST', async () => {
    const snapshot = await service.getCampaignAnalytics(
      {
        hubspotCampaignId: campaignId,
        reportingPeriodStart: '2026-07-01',
        reportingPeriodEnd: '2026-09-30',
      },
      { includeEmailStatistics: false },
    );

    expect(snapshot.assetsByType?.SOCIAL_BROADCAST).toBeTruthy();
    expect(snapshot.assetsByType?.LANDING_PAGE).toBeUndefined();
    expect(
      snapshot.warnings.some((w) => w.includes('assetsByType')),
    ).toBe(true);
  });

  it('falls back to a 90-day window when reporting period is empty', async () => {
    const snapshot = await service.getCampaignAnalytics(
      { hubspotCampaignId: campaignId },
      { includeEmailStatistics: false },
    );

    expect(snapshot.reportingPeriodStart).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(snapshot.reportingPeriodEnd).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(
      snapshot.warnings.some((w) => w.includes('last-90-days')),
    ).toBe(true);

    const socialCalls = fetchMock.mock.calls
      .map((c: unknown[]) => String(c[0]))
      .filter((u: string) => u.includes('SOCIAL_BROADCAST'));
    expect(socialCalls[0]).toContain('startDate=');
    expect(socialCalls[0]).toContain('endDate=');
  });

  it('skips asset bundle when includeAssetBundle is false', async () => {
    const snapshot = await service.getCampaignAnalytics(
      {
        hubspotCampaignId: campaignId,
        reportingPeriodStart: '2026-07-01',
        reportingPeriodEnd: '2026-09-30',
      },
      { includeEmailStatistics: false, includeAssetBundle: false },
    );

    expect(snapshot.assetsByType).toBeUndefined();
    expect(snapshot.socialPosts).toBeUndefined();
    const socialCalls = fetchMock.mock.calls
      .map((c: unknown[]) => String(c[0]))
      .filter((u: string) => u.includes('SOCIAL_BROADCAST'));
    expect(socialCalls).toHaveLength(0);
  });

  it('produces socialClicks via metricsFromHubspotSnapshot (sync → cache path)', async () => {
    const snapshot = await service.getCampaignAnalytics(
      {
        hubspotCampaignId: campaignId,
        reportingPeriodStart: '2026-07-01',
        reportingPeriodEnd: '2026-09-30',
      },
      { includeEmailStatistics: false },
    );

    const cached = metricsFromHubspotSnapshot(snapshot);
    expect(cached.metrics.socialClicks).toBe(5);
    expect(cached.socialPosts).toHaveLength(1);
  });
});

describe('HubSpotService.getCampaignAssets pagination (CPR-56 chunk 4)', () => {
  const fetchMock = jest.fn();
  const realFetch = global.fetch;
  let service: HubSpotService;
  const campaignId = '6169fb82-1c1d-448f-9a65-9a92bea0b1e9';

  beforeEach(() => {
    fetchMock.mockReset();
    global.fetch = fetchMock as unknown as typeof fetch;
    service = new HubSpotService(
      new ConfigService({
        hubspot: { accessToken: 'pat-na1-00000000-test-token-for-spec' },
      }),
    );
  });

  afterAll(() => {
    global.fetch = realFetch;
  });

  it('merges multiple SOCIAL_BROADCAST pages via paging.next.after', async () => {
    fetchMock.mockImplementation(async (url: string) => {
      const path = String(url);
      if (!path.includes('SOCIAL_BROADCAST')) {
        return jsonResponse({ results: [] });
      }
      if (path.includes('after=page2')) {
        return jsonResponse({
          results: [
            {
              id: 'soc-3',
              name: 'page2',
              metrics: { LINKEDIN_CLICKS: 1 },
            },
          ],
        });
      }
      if (path.includes('after=page1')) {
        return jsonResponse({
          results: [
            {
              id: 'soc-2',
              name: 'page1',
              metrics: { LINKEDIN_CLICKS: 2 },
            },
          ],
          paging: { next: { after: 'page2' } },
        });
      }
      return jsonResponse({
        results: [
          {
            id: 'soc-1',
            name: 'page0',
            metrics: { LINKEDIN_CLICKS: 3 },
          },
        ],
        paging: { next: { after: 'page1' } },
      });
    });

    const payload = await service.getCampaignAssets(
      campaignId,
      'SOCIAL_BROADCAST',
      { startDate: '2026-07-01', endDate: '2026-09-30' },
    );

    expect(payload.truncated).toBeUndefined();
    expect(payload.results.map((r) => (r as { id: string }).id)).toEqual([
      'soc-1',
      'soc-2',
      'soc-3',
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(String(fetchMock.mock.calls[1][0])).toContain('after=page1');
    expect(String(fetchMock.mock.calls[2][0])).toContain('after=page2');
  });

  it('sets truncated when more pages exist beyond maxPages', async () => {
    fetchMock.mockImplementation(async (url: string) => {
      const path = String(url);
      const afterMatch = /[?&]after=([a-zA-Z0-9_-]+)/.exec(path);
      const page = afterMatch ? Number(afterMatch[1].replace('p', '')) : 0;
      return jsonResponse({
        results: [{ id: `soc-${page}`, name: `p${page}`, metrics: {} }],
        paging: { next: { after: `p${page + 1}` } },
      });
    });

    const payload = await service.getCampaignAssets(
      campaignId,
      'SOCIAL_BROADCAST',
      { maxPages: 2, limit: 10 },
    );

    expect(payload.truncated).toBe(true);
    expect(payload.results).toHaveLength(2);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('surfaces truncation warning on getCampaignAnalytics snapshot', async () => {
    // Default maxPages=10: always return a next cursor so the cap triggers.
    let socialPage = 0;
    fetchMock.mockImplementation(async (url: string) => {
      const path = String(url);
      if (path.includes('/integrations/v1/me')) {
        return jsonResponse({ portalId: 1 });
      }
      if (path.includes('/reports/metrics')) {
        return jsonResponse({});
      }
      if (
        path.includes(`/campaigns/${campaignId}`) &&
        !path.includes('/assets/')
      ) {
        return jsonResponse({ id: campaignId });
      }
      if (path.includes('/assets/SOCIAL_BROADCAST')) {
        socialPage += 1;
        return jsonResponse({
          results: [
            { id: `soc-${socialPage}`, name: `n${socialPage}`, metrics: {} },
          ],
          paging: { next: { after: `p${socialPage}` } },
        });
      }
      if (path.includes('/assets/')) {
        return jsonResponse({ results: [] });
      }
      return jsonResponse({});
    });

    const snapshot = await service.getCampaignAnalytics(
      {
        hubspotCampaignId: campaignId,
        reportingPeriodStart: '2026-07-01',
        reportingPeriodEnd: '2026-09-30',
      },
      { includeEmailStatistics: false },
    );

    expect(snapshot.assetsByType?.SOCIAL_BROADCAST).toMatchObject({
      truncated: true,
    });
    expect(
      snapshot.warnings.some(
        (w) => w.includes('truncated') && w.includes('SOCIAL_BROADCAST'),
      ),
    ).toBe(true);
    expect(
      (snapshot.assetsByType?.SOCIAL_BROADCAST as { results: unknown[] })
        .results,
    ).toHaveLength(10);
  });
});

describe('HubSpotService social broadcast enrich (CPR-56 chunk 5)', () => {
  const fetchMock = jest.fn();
  const realFetch = global.fetch;
  let service: HubSpotService;
  const campaignId = '6169fb82-1c1d-448f-9a65-9a92bea0b1e9';

  beforeEach(() => {
    fetchMock.mockReset();
    global.fetch = fetchMock as unknown as typeof fetch;
    service = new HubSpotService(
      new ConfigService({
        hubspot: { accessToken: 'pat-na1-00000000-test-token-for-spec' },
      }),
    );
  });

  afterAll(() => {
    global.fetch = realFetch;
  });

  function mockAnalyticsBase(handlers: {
    socialAsset?: unknown;
    broadcast?: (id: string) => ReturnType<typeof jsonResponse>;
  }) {
    fetchMock.mockImplementation(async (url: string) => {
      const path = String(url);
      if (path.includes('/integrations/v1/me')) {
        return jsonResponse({ portalId: 1 });
      }
      if (path.includes('/reports/metrics')) {
        return jsonResponse({});
      }
      if (
        path.includes(`/campaigns/${campaignId}`) &&
        !path.includes('/assets/')
      ) {
        return jsonResponse({ id: campaignId });
      }
      if (path.includes('/assets/SOCIAL_BROADCAST')) {
        return jsonResponse(
          handlers.socialAsset ?? {
            results: [
              {
                id: 'soc-1',
                name: 'LI caption',
                metrics: { LINKEDIN_CLICKS: 2 },
              },
            ],
          },
        );
      }
      if (path.includes('/assets/')) {
        return jsonResponse({ results: [] });
      }
      const broadcastMatch = /\/broadcast\/v1\/broadcasts\/([^/?]+)/.exec(path);
      if (broadcastMatch) {
        const id = decodeURIComponent(broadcastMatch[1]);
        if (handlers.broadcast) return handlers.broadcast(id);
        return jsonResponse({
          broadcastGuid: id,
          channelKey: 'LinkedIn-channel',
          status: 'SUCCESS',
          finishedAt: 1_724_000_000_000,
          message: 'Enriched body',
          content: {
            originalLink: 'https://www.linkedin.com/feed/update/urn:li:share:9',
          },
        });
      }
      return jsonResponse({});
    });
  }

  it('enriches socialPosts and stores socialBroadcastDetails when social API works', async () => {
    mockAnalyticsBase({});

    const snapshot = await service.getCampaignAnalytics(
      {
        hubspotCampaignId: campaignId,
        reportingPeriodStart: '2026-07-01',
        reportingPeriodEnd: '2026-09-30',
      },
      { includeEmailStatistics: false },
    );

    expect(snapshot.socialPosts?.[0]).toMatchObject({
      id: 'soc-1',
      totalClicks: 2,
      network: 'LinkedIn',
      contentUrl: 'https://www.linkedin.com/feed/update/urn:li:share:9',
      broadcastStatus: 'SUCCESS',
    });
    expect(snapshot.socialPosts?.[0].publishedAt).toBeTruthy();
    expect(snapshot.socialBroadcastDetails?.['soc-1']).toBeTruthy();
  });

  it('warns and continues when social scope is missing (403)', async () => {
    mockAnalyticsBase({
      broadcast: () =>
        jsonResponse(
          {
            status: 'error',
            category: 'MISSING_SCOPES',
            message: 'missing social scope',
            errors: [
              {
                context: { requiredGranularScopes: ['social'] },
              },
            ],
          },
          403,
        ),
    });

    const snapshot = await service.getCampaignAnalytics(
      {
        hubspotCampaignId: campaignId,
        reportingPeriodStart: '2026-07-01',
        reportingPeriodEnd: '2026-09-30',
      },
      { includeEmailStatistics: false },
    );

    expect(snapshot.socialPosts).toHaveLength(1);
    expect(snapshot.socialPosts?.[0].totalClicks).toBe(2);
    expect(snapshot.socialPosts?.[0].contentUrl).toBeUndefined();
    expect(snapshot.socialBroadcastDetails).toBeUndefined();
    expect(
      snapshot.warnings.some((w) => w.includes('social') && w.includes('scope')),
    ).toBe(true);
  });

  it('skips enrich when includeSocialBroadcastDetails is false', async () => {
    mockAnalyticsBase({});

    const snapshot = await service.getCampaignAnalytics(
      {
        hubspotCampaignId: campaignId,
        reportingPeriodStart: '2026-07-01',
        reportingPeriodEnd: '2026-09-30',
      },
      {
        includeEmailStatistics: false,
        includeSocialBroadcastDetails: false,
      },
    );

    expect(snapshot.socialPosts?.[0].contentUrl).toBeUndefined();
    expect(snapshot.socialBroadcastDetails).toBeUndefined();
    const broadcastCalls = fetchMock.mock.calls
      .map((c: unknown[]) => String(c[0]))
      .filter((u: string) => u.includes('/broadcast/v1/broadcasts/'));
    expect(broadcastCalls).toHaveLength(0);
  });
});
