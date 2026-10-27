import {
  accumulateMetricsFromUnknown,
  EMPTY_CAMPAIGN_METRIC_TOTALS,
  mergeMetricTotals,
  metricsFromHubspotSnapshot,
  parseSocialPostsFromAssets,
  slimCampaignAssetPayload,
} from './hubspot-campaign-metrics.util';

describe('hubspot-campaign-metrics.util (CPR-56 chunk 1)', () => {
  describe('slimCampaignAssetPayload', () => {
    it('keeps id/name/metrics and drops extras', () => {
      const slim = slimCampaignAssetPayload({
        results: [
          {
            id: 'a1',
            name: 'Post',
            metrics: { LINKEDIN_CLICKS: 2 },
            unused: 'drop-me',
            body: 'huge',
          },
        ],
        truncated: true,
      }) as { results: Record<string, unknown>[]; truncated?: boolean };

      expect(slim.truncated).toBe(true);
      expect(slim.results).toEqual([
        { id: 'a1', name: 'Post', metrics: { LINKEDIN_CLICKS: 2 } },
      ]);
    });
  });

  describe('accumulateMetricsFromUnknown — social click keys', () => {
    it('maps HubSpot FACEBOOK_CLICKS / LINKEDIN_CLICKS / TWITTER_CLICKS to socialClicks', () => {
      const totals = accumulateMetricsFromUnknown({
        metrics: {
          FACEBOOK_CLICKS: 3,
          LINKEDIN_CLICKS: 5,
          TWITTER_CLICKS: 2,
        },
      });

      expect(totals.socialClicks).toBe(10);
      expect(totals.emailClicks).toBe(0);
    });

    it('maps underscore forms when present (defensive)', () => {
      const totals = accumulateMetricsFromUnknown({
        metrics: {
          facebook_clicks: 1,
          linkedin_clicks: 1,
          twitter_clicks: 1,
        },
      });

      expect(totals.socialClicks).toBe(3);
    });

    it('sums social clicks from a SOCIAL_BROADCAST assets payload', () => {
      const totals = accumulateMetricsFromUnknown({
        results: [
          {
            id: 'post-a',
            name: 'LinkedIn post',
            metrics: { LINKEDIN_CLICKS: 4, FACEBOOK_CLICKS: 0, TWITTER_CLICKS: 0 },
          },
          {
            id: 'post-b',
            name: 'Facebook post',
            metrics: { FACEBOOK_CLICKS: 7, LINKEDIN_CLICKS: null, TWITTER_CLICKS: 1 },
          },
        ],
      });

      expect(totals.socialClicks).toBe(12);
    });
  });

  describe('accumulateMetricsFromUnknown — email / other keys unchanged', () => {
    it('still maps MARKETING_EMAIL CLICKS / OPEN / SENT to email fields', () => {
      const totals = accumulateMetricsFromUnknown({
        metrics: {
          SENT: 100,
          OPEN: 40,
          CLICKS: 12,
        },
      });

      expect(totals.emailSent).toBe(100);
      expect(totals.emailOpens).toBe(40);
      expect(totals.emailClicks).toBe(12);
      expect(totals.socialClicks).toBe(0);
    });

    it('does not bleed social keys into emailClicks', () => {
      const totals = accumulateMetricsFromUnknown({
        results: [
          {
            id: 'social-1',
            metrics: {
              FACEBOOK_CLICKS: 9,
              LINKEDIN_CLICKS: 1,
              TWITTER_CLICKS: 0,
            },
          },
        ],
      });

      expect(totals.socialClicks).toBe(10);
      expect(totals.emailClicks).toBe(0);
    });
  });

  describe('mixed email + social payload', () => {
    it('accumulates email and social totals without cross-bleed', () => {
      const emailAsset = {
        results: [
          {
            id: 'email-1',
            metrics: { SENT: 50, OPEN: 20, CLICKS: 8 },
          },
        ],
      };
      const socialAsset = {
        results: [
          {
            id: 'social-1',
            metrics: { FACEBOOK_CLICKS: 2, LINKEDIN_CLICKS: 3, TWITTER_CLICKS: 1 },
          },
        ],
      };

      const totals = mergeMetricTotals(
        accumulateMetricsFromUnknown(emailAsset),
        accumulateMetricsFromUnknown(socialAsset),
      );

      expect(totals).toMatchObject({
        emailSent: 50,
        emailOpens: 20,
        emailClicks: 8,
        socialClicks: 6,
      });
    });
  });

  describe('parseSocialPostsFromAssets', () => {
    it('parses per-network clicks and totalClicks (regression)', () => {
      const posts = parseSocialPostsFromAssets({
        results: [
          {
            id: 'abc',
            name: 'LinkedIn share',
            metrics: {
              FACEBOOK_CLICKS: 0,
              LINKEDIN_CLICKS: 4,
              TWITTER_CLICKS: 0,
            },
          },
        ],
      });

      expect(posts).toHaveLength(1);
      expect(posts[0]).toMatchObject({
        id: 'abc',
        linkedinClicks: 4,
        facebookClicks: 0,
        twitterClicks: 0,
        totalClicks: 4,
        network: 'LinkedIn',
      });
    });

    it('returns empty for null / non-object', () => {
      expect(parseSocialPostsFromAssets(null)).toEqual([]);
      expect(parseSocialPostsFromAssets(undefined)).toEqual([]);
      expect(parseSocialPostsFromAssets('x')).toEqual([]);
    });
  });

  describe('mergeMetricTotals', () => {
    it('starts from empty totals', () => {
      expect(mergeMetricTotals()).toEqual(EMPTY_CAMPAIGN_METRIC_TOTALS);
    });
  });
});

describe('metricsFromHubspotSnapshot (CPR-56 chunk 2)', () => {
  const socialBroadcast = {
    results: [
      {
        id: 'soc-1',
        name: 'LinkedIn post',
        metrics: {
          FACEBOOK_CLICKS: 0,
          LINKEDIN_CLICKS: 4,
          TWITTER_CLICKS: 1,
        },
      },
      {
        id: 'soc-2',
        name: 'Facebook post',
        metrics: {
          FACEBOOK_CLICKS: 3,
          LINKEDIN_CLICKS: 0,
          TWITTER_CLICKS: 0,
        },
      },
    ],
  };

  const marketingEmail = {
    results: [
      {
        id: 'em-1',
        metrics: { SENT: 100, OPEN: 40, CLICKS: 10 },
      },
    ],
  };

  it('accumulates socialClicks from assetsByType.SOCIAL_BROADCAST', () => {
    const { metrics, socialPosts, assetCounts } = metricsFromHubspotSnapshot({
      metrics: null,
      campaign: null,
      assets: null,
      emailStatistics: null,
      assetsByType: { SOCIAL_BROADCAST: socialBroadcast },
    });

    expect(metrics.socialClicks).toBe(8);
    expect(socialPosts).toHaveLength(2);
    expect(socialPosts.map((p) => p.totalClicks)).toEqual([5, 3]);
    expect(assetCounts.SOCIAL_BROADCAST).toBe(2);
  });

  it('does not double-count when campaign object repeats SOCIAL click keys', () => {
    const { metrics, socialPosts } = metricsFromHubspotSnapshot({
      campaign: {
        metrics: {
          FACEBOOK_CLICKS: 3,
          LINKEDIN_CLICKS: 4,
          TWITTER_CLICKS: 1,
        },
      },
      assetsByType: { SOCIAL_BROADCAST: socialBroadcast },
    });

    // socialBroadcast totals 8; campaign alone would add another 8 → 16 without dedupe.
    expect(socialPosts).toHaveLength(2);
    expect(metrics.socialClicks).toBe(8);
  });

  it('keeps old snapshots without assetsByType working (no throw, empty social)', () => {
    const { metrics, socialPosts, assetCounts } = metricsFromHubspotSnapshot({
      metrics: { sessions: 12 },
      campaign: null,
      assets: null,
      emailStatistics: null,
    });

    expect(metrics.sessions).toBe(12);
    expect(metrics.socialClicks).toBe(0);
    expect(socialPosts).toEqual([]);
    expect(assetCounts).toEqual({});
  });

  it('combines legacy assets (email) with assetsByType social without cross-bleed', () => {
    const { metrics, socialPosts, assetCounts } = metricsFromHubspotSnapshot({
      metrics: null,
      campaign: null,
      assets: marketingEmail,
      emailStatistics: null,
      assetsByType: { SOCIAL_BROADCAST: socialBroadcast },
    });

    expect(metrics).toMatchObject({
      emailSent: 100,
      emailOpens: 40,
      emailClicks: 10,
      socialClicks: 8,
    });
    expect(socialPosts).toHaveLength(2);
    expect(assetCounts.MARKETING_EMAIL).toBe(1);
    expect(assetCounts.SOCIAL_BROADCAST).toBe(2);
  });

  it('does not double-count MARKETING_EMAIL when present in both assets and assetsByType', () => {
    const { metrics } = metricsFromHubspotSnapshot({
      assets: marketingEmail,
      assetsByType: {
        MARKETING_EMAIL: marketingEmail,
        SOCIAL_BROADCAST: socialBroadcast,
      },
    });

    expect(metrics.emailSent).toBe(100);
    expect(metrics.emailClicks).toBe(10);
    expect(metrics.socialClicks).toBe(8);
  });

  it('uses already-parsed socialPosts when SOCIAL_BROADCAST is absent', () => {
    const { socialPosts, metrics } = metricsFromHubspotSnapshot({
      socialPosts: [
        {
          id: 'parsed-1',
          name: 'Cached post',
          network: 'LinkedIn',
          facebookClicks: 0,
          linkedinClicks: 2,
          twitterClicks: 0,
          totalClicks: 2,
        },
      ],
    });

    expect(socialPosts).toHaveLength(1);
    expect(socialPosts[0].id).toBe('parsed-1');
    expect(socialPosts[0].totalClicks).toBe(2);
    expect(metrics.socialClicks).toBe(2);
  });

  it('prefers enriched socialPosts over raw SOCIAL_BROADCAST assets', () => {
    const { socialPosts, metrics } = metricsFromHubspotSnapshot({
      socialPosts: [
        {
          id: 'soc-1',
          name: 'Enriched caption',
          network: 'LinkedIn',
          facebookClicks: 0,
          linkedinClicks: 5,
          twitterClicks: 0,
          totalClicks: 5,
          contentUrl: 'https://www.linkedin.com/feed/update/urn:li:share:1',
          publishedAt: '2026-10-14T16:24:04.342Z',
          channelKey: 'LinkedInCompanyPage:1',
        },
      ],
      assetsByType: {
        SOCIAL_BROADCAST: {
          results: [
            {
              id: 'soc-1',
              name: 'Raw caption only',
              metrics: { LINKEDIN_CLICKS: 5 },
            },
          ],
        },
      },
    });

    expect(socialPosts).toHaveLength(1);
    expect(socialPosts[0].contentUrl).toContain('linkedin.com');
    expect(socialPosts[0].publishedAt).toBeTruthy();
    expect(socialPosts[0].channelKey).toBe('LinkedInCompanyPage:1');
    expect(metrics.socialClicks).toBe(5);
  });

  it('returns empty totals for null / non-object input', () => {
    expect(metricsFromHubspotSnapshot(null)).toEqual({
      metrics: EMPTY_CAMPAIGN_METRIC_TOTALS,
      assetCounts: {},
      socialPosts: [],
    });
    expect(metricsFromHubspotSnapshot('x').socialPosts).toEqual([]);
  });
});
