import { KolMutationsService } from './kol-mutations.service';
import type { ContentHubClientService } from '../content-hub/content-hub-client.service';

describe('KolMutationsService', () => {
  const makeClient = () => {
    const calls: Array<{
      method: string;
      path: string;
      body?: unknown;
    }> = [];
    const client: Partial<ContentHubClientService> = {
      isAdminConfigured: jest.fn().mockReturnValue(true),
      patchAdmin: jest.fn(async (path: string, body: unknown) => {
        calls.push({ method: 'PATCH', path, body });
        return {} as never;
      }),
      postAdmin: jest.fn(async (path: string, body?: unknown) => {
        calls.push({ method: 'POST', path, body });
        return {} as never;
      }),
    };
    return { client: client as ContentHubClientService, calls };
  };

  it('PATCHes to /kols/{slug} with the update body', async () => {
    const { client, calls } = makeClient();
    const service = new KolMutationsService(client);
    await service.patchKol('dr-a', { title: 'MD', featured: true });
    expect(calls[0]).toEqual({
      method: 'PATCH',
      path: '/kols/dr-a',
      body: { title: 'MD', featured: true },
    });
  });

  it('url-encodes the slug for PATCH', async () => {
    const { client, calls } = makeClient();
    const service = new KolMutationsService(client);
    await service.patchKol('dr smith/x', {});
    expect(calls[0].path).toBe('/kols/dr%20smith%2Fx');
  });

  it('POSTs to /kols/{slug}/refresh with no body', async () => {
    const { client, calls } = makeClient();
    const service = new KolMutationsService(client);
    await service.refreshKol('dr-a');
    expect(calls[0]).toEqual({
      method: 'POST',
      path: '/kols/dr-a/refresh',
      body: undefined,
    });
  });

  it('POSTs to /kols/{slug}/headshot/presign with content_type', async () => {
    const { client, calls } = makeClient();
    const service = new KolMutationsService(client);
    await service.presignHeadshot('dr-a', { content_type: 'image/png' });
    expect(calls[0]).toEqual({
      method: 'POST',
      path: '/kols/dr-a/headshot/presign',
      body: { content_type: 'image/png' },
    });
  });
});
