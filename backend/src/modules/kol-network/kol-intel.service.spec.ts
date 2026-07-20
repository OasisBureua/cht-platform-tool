import { KolIntelService } from './kol-intel.service';
import type { ContentHubClientService } from '../content-hub/content-hub-client.service';

describe('KolIntelService', () => {
  const makeClient = () => {
    const calls: Array<{ path: string; params?: Record<string, unknown> }> = [];
    const client: Partial<ContentHubClientService> = {
      isAdminConfigured: jest.fn().mockReturnValue(true),
      getAdmin: jest.fn(async (path: string, params?: Record<string, unknown>) => {
        calls.push({ path, params });
        return {} as never;
      }),
    };
    return { client: client as ContentHubClientService, calls };
  };

  it('proxies engagement to /kols/{slug}/engagement', async () => {
    const { client, calls } = makeClient();
    const service = new KolIntelService(client);
    await service.getEngagement('dr-a');
    expect(calls[0].path).toBe('/kols/dr-a/engagement');
  });

  it('url-encodes the slug', async () => {
    const { client, calls } = makeClient();
    const service = new KolIntelService(client);
    await service.getEngagement('dr smith/x');
    expect(calls[0].path).toBe('/kols/dr%20smith%2Fx/engagement');
  });

  it('forwards paginated params for publications', async () => {
    const { client, calls } = makeClient();
    const service = new KolIntelService(client);
    await service.getPublications('dr-a', { limit: 25, offset: 50 });
    expect(calls[0].path).toBe('/kols/dr-a/publications');
    expect(calls[0].params).toEqual({ limit: 25, offset: 50 });
  });

  it('omits undefined query params', async () => {
    const { client, calls } = makeClient();
    const service = new KolIntelService(client);
    await service.getPublications('dr-a');
    expect(calls[0].params).toEqual({});
  });

  it('forwards limit for open-payments', async () => {
    const { client, calls } = makeClient();
    const service = new KolIntelService(client);
    await service.getOpenPayments('dr-a', { limit: 200 });
    expect(calls[0].path).toBe('/kols/dr-a/open-payments');
    expect(calls[0].params).toEqual({ limit: 200 });
  });

  it('proxies trials with pagination', async () => {
    const { client, calls } = makeClient();
    const service = new KolIntelService(client);
    await service.getTrials('dr-a', { limit: 100, offset: 0 });
    expect(calls[0].path).toBe('/kols/dr-a/trials');
    expect(calls[0].params).toEqual({ limit: 100, offset: 0 });
  });

  it('proxies news with pagination', async () => {
    const { client, calls } = makeClient();
    const service = new KolIntelService(client);
    await service.getNews('dr-a', { limit: 50, offset: 10 });
    expect(calls[0].path).toBe('/kols/dr-a/news');
    expect(calls[0].params).toEqual({ limit: 50, offset: 10 });
  });

  it('reports isConfigured from the underlying client', () => {
    const { client } = makeClient();
    const service = new KolIntelService(client);
    expect(service.isConfigured()).toBe(true);
  });
});
