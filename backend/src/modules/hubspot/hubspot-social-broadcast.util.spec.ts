import {
  applyBroadcastEnrichment,
  networkFromChannelKey,
  parseBroadcastEnrichment,
} from './hubspot-social-broadcast.util';
import type { HubSpotSocialPost } from './hubspot-campaign-metrics.util';

describe('hubspot-social-broadcast.util (CPR-56 chunk 5)', () => {
  const basePost: HubSpotSocialPost = {
    id: 'bcast-1',
    name: 'Asset caption',
    network: null,
    facebookClicks: 0,
    linkedinClicks: 4,
    twitterClicks: 0,
    totalClicks: 4,
  };

  it('maps channelKey prefixes to network labels', () => {
    expect(networkFromChannelKey('LinkedIn-abc')).toBe('LinkedIn');
    expect(networkFromChannelKey('Facebook:123')).toBe('Facebook');
    expect(networkFromChannelKey('Instagram-x')).toBe('Instagram');
    expect(networkFromChannelKey('Twitter-9')).toBe('X');
    expect(networkFromChannelKey(null)).toBeNull();
  });

  it('parses finishedAt / content.originalLink from a broadcast payload', () => {
    const parsed = parseBroadcastEnrichment({
      broadcastGuid: 'bcast-1',
      channelKey: 'LinkedIn-urn',
      status: 'SUCCESS',
      finishedAt: 1_724_000_000_000,
      message: 'Hello from LI',
      content: {
        originalLink: 'https://www.linkedin.com/feed/update/urn:li:share:1',
      },
    });

    expect(parsed).toMatchObject({
      network: 'LinkedIn',
      channelKey: 'LinkedIn-urn',
      broadcastStatus: 'SUCCESS',
      contentUrl: 'https://www.linkedin.com/feed/update/urn:li:share:1',
      message: 'Hello from LI',
    });
    expect(parsed?.publishedAt).toBe(new Date(1_724_000_000_000).toISOString());
  });

  it('applies enrich fields onto a social post without dropping clicks', () => {
    const enrichment = parseBroadcastEnrichment({
      channelKey: 'Facebook-page',
      finishedAt: 1_724_000_000_000,
      content: { link: 'https://facebook.com/posts/1' },
      message: 'FB copy',
    });
    expect(enrichment).not.toBeNull();

    const merged = applyBroadcastEnrichment(basePost, enrichment!);
    expect(merged).toMatchObject({
      id: 'bcast-1',
      totalClicks: 4,
      linkedinClicks: 4,
      network: 'Facebook',
      contentUrl: 'https://facebook.com/posts/1',
      name: 'FB copy',
    });
    expect(merged.publishedAt).toBeTruthy();
  });

  it('returns null for non-object broadcast payloads', () => {
    expect(parseBroadcastEnrichment(null)).toBeNull();
    expect(parseBroadcastEnrichment('x')).toBeNull();
  });
});
