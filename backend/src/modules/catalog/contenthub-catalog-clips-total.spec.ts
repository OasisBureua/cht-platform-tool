import { of } from 'rxjs';
import { ContentHubCatalogService } from './contenthub-catalog.service';

/**
 * ContentHub /clips returns one page as a bare array and the full filtered
 * count in `X-Total-Count`. `total` must be that count, not the page length.
 */
describe('ContentHubCatalogService.getClips total', () => {
  function buildService(headers: Record<string, string>) {
    const svc = Object.create(
      ContentHubCatalogService.prototype,
    ) as ContentHubCatalogService;
    const page = [{ id: 'official:youtube:aaaaaaaaaaa' }];
    Object.assign(svc, {
      publicBaseUrl: 'https://hub.test/api/public',
      useContentHub: true,
      wordpressOnlyDefault: false,
      clipsCacheTtlSeconds: 60,
      logger: { warn: jest.fn(), log: jest.fn() },
      config: { get: () => 'prod' },
      cache: {
        getJson: jest.fn().mockResolvedValue(null),
        setJson: jest.fn().mockResolvedValue(undefined),
      },
      http: { get: jest.fn(() => of({ data: page, headers })) },
      m2mTokens: { getAccessToken: jest.fn().mockResolvedValue('t') },
      seedClipCache: jest.fn().mockResolvedValue(undefined),
    });
    return svc;
  }

  it('uses X-Total-Count for a bare-array page', async () => {
    const svc = buildService({ 'x-total-count': '474' });
    const result = await svc.getClips({ limit: 50, offset: 0 });
    expect(result.total).toBe(474);
    expect(result.items).toHaveLength(1);
  });

  it('falls back to the page length when the header is missing', async () => {
    const svc = buildService({});
    const result = await svc.getClips({ limit: 50, offset: 0 });
    expect(result.total).toBe(1);
  });
});
