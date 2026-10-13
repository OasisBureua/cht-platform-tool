import { ConflictException, ServiceUnavailableException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
import type { PrismaService } from '../../prisma/prisma.service';
import { CANVA_API, CanvaService, PPTX_MIME } from './canva.service';

type Row = {
  id: string;
  userId: string;
  accessToken: string | null;
  refreshToken: string | null;
  expiresAt: Date | null;
  scope: string | null;
  pendingState: string | null;
  pendingVerifier: string | null;
  pendingExpiresAt: Date | null;
};

/** An in-memory stand-in for prisma.canvaConnection. */
function fakePrisma() {
  const rows: Row[] = [];
  const pick = (where: Partial<Row>) =>
    rows.find((r) =>
      Object.entries(where).every(([k, v]) => r[k as keyof Row] === v),
    ) ?? null;
  const canvaConnection = {
    findUnique: jest.fn(({ where }: { where: Partial<Row> }) =>
      Promise.resolve(pick(where)),
    ),
    upsert: jest.fn(
      ({
        where,
        create,
        update,
      }: {
        where: Partial<Row>;
        create: Partial<Row>;
        update: Partial<Row>;
      }) => {
        const hit = pick(where);
        if (hit) return Promise.resolve(Object.assign(hit, update));
        const row: Row = {
          id: `c${rows.length + 1}`,
          userId: '',
          accessToken: null,
          refreshToken: null,
          expiresAt: null,
          scope: null,
          pendingState: null,
          pendingVerifier: null,
          pendingExpiresAt: null,
          ...create,
        };
        rows.push(row);
        return Promise.resolve(row);
      },
    ),
    update: jest.fn(
      ({ where, data }: { where: Partial<Row>; data: Partial<Row> }) =>
        Promise.resolve(Object.assign(pick(where) as Row, data)),
    ),
  };
  return { rows, prisma: { canvaConnection } as unknown as PrismaService };
}

function config(values: Record<string, string>): ConfigService {
  return { get: (k: string) => values[k] } as unknown as ConfigService;
}

const CONFIGURED = {
  'canva.clientId': 'client-id',
  'canva.clientSecret': 'client-secret',
  frontendUrl: 'https://testapp.communityhealth.media/',
};

function jsonResponse(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  } as Response;
}

describe('CanvaService', () => {
  const realFetch = global.fetch;
  let fetchMock: jest.Mock;
  const calls = () => fetchMock.mock.calls as [string, RequestInit][];

  beforeEach(() => {
    fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
  });
  afterEach(() => {
    global.fetch = realFetch;
  });

  it('reports not configured and refuses to start without the app keys', async () => {
    const { prisma } = fakePrisma();
    const svc = new CanvaService(prisma, config({}));
    await expect(svc.status('u1')).resolves.toEqual({
      configured: false,
      connected: false,
    });
    await expect(svc.authorizeUrl('u1')).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it('seals tokens so they read back but are not stored in the clear', () => {
    const svc = new CanvaService(fakePrisma().prisma, config(CONFIGURED));
    const sealed = svc.seal('secret-token');
    expect(sealed).not.toContain('secret-token');
    expect(svc.open(sealed)).toBe('secret-token');
    const other = new CanvaService(
      fakePrisma().prisma,
      config({ ...CONFIGURED, 'canva.clientSecret': 'rotated' }),
    );
    expect(() => other.open(sealed)).toThrow();
  });

  it('builds a PKCE consent URL and keeps the verifier for the callback', async () => {
    const { prisma, rows } = fakePrisma();
    const svc = new CanvaService(prisma, config(CONFIGURED));
    const url = new URL(await svc.authorizeUrl('u1'));
    expect(url.origin + url.pathname).toBe(
      'https://www.canva.com/api/oauth/authorize',
    );
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    expect(url.searchParams.get('scope')).toBe('design:content:write');
    expect(url.searchParams.get('redirect_uri')).toBe(
      'https://testapp.communityhealth.media/api/canva/callback',
    );
    const row = rows[0];
    expect(url.searchParams.get('state')).toBe(row.pendingState);
    const verifier = svc.open(row.pendingVerifier as string);
    expect(url.searchParams.get('code_challenge')).toBe(
      createHash('sha256').update(verifier).digest('base64url'),
    );
  });

  it('swaps the code for tokens on the callback and clears the pending sign-in', async () => {
    const { prisma, rows } = fakePrisma();
    const svc = new CanvaService(prisma, config(CONFIGURED));
    const state = new URL(await svc.authorizeUrl('u1')).searchParams.get(
      'state',
    ) as string;
    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, {
        access_token: 'at-1',
        refresh_token: 'rt-1',
        expires_in: 14400,
        scope: 'design:content:write',
      }),
    );
    await svc.completeAuthorization('the-code', state);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${CANVA_API}/oauth/token`);
    expect((init.headers as Record<string, string>).Authorization).toBe(
      `Basic ${Buffer.from('client-id:client-secret').toString('base64')}`,
    );
    const body = new URLSearchParams(init.body as string);
    expect(body.get('grant_type')).toBe('authorization_code');
    expect(body.get('code')).toBe('the-code');
    expect(body.get('code_verifier')).toBeTruthy();

    const row = rows[0];
    expect(row.pendingState).toBeNull();
    expect(svc.open(row.refreshToken as string)).toBe('rt-1');
    await expect(svc.status('u1')).resolves.toEqual({
      configured: true,
      connected: true,
    });
    await expect(svc.accessToken('u1')).resolves.toBe('at-1');
  });

  it('rejects a callback whose state is unknown or expired', async () => {
    const { prisma, rows } = fakePrisma();
    const svc = new CanvaService(prisma, config(CONFIGURED));
    await expect(svc.completeAuthorization('code', 'nope')).rejects.toThrow(
      'expired',
    );
    const state = new URL(await svc.authorizeUrl('u1')).searchParams.get(
      'state',
    ) as string;
    rows[0].pendingExpiresAt = new Date(Date.now() - 1000);
    await expect(svc.completeAuthorization('code', state)).rejects.toThrow(
      'expired',
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('refreshes a lapsed token once and stores the rotated refresh token', async () => {
    const { prisma, rows } = fakePrisma();
    const svc = new CanvaService(prisma, config(CONFIGURED));
    rows.push({
      id: 'c1',
      userId: 'u1',
      accessToken: svc.seal('old'),
      refreshToken: svc.seal('rt-1'),
      expiresAt: new Date(Date.now() - 1),
      scope: null,
      pendingState: null,
      pendingVerifier: null,
      pendingExpiresAt: null,
    });
    fetchMock.mockResolvedValue(
      jsonResponse(200, {
        access_token: 'at-2',
        refresh_token: 'rt-2',
        expires_in: 14400,
      }),
    );
    const [a, b] = await Promise.all([
      svc.accessToken('u1'),
      svc.accessToken('u1'),
    ]);
    expect(a).toBe('at-2');
    expect(b).toBe('at-2');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(
      new URLSearchParams(calls()[0][1].body as string).get('refresh_token'),
    ).toBe('rt-1');
    expect(svc.open(rows[0].refreshToken as string)).toBe('rt-2');
  });

  it('forgets the connection when Canva rejects the refresh token', async () => {
    const { prisma, rows } = fakePrisma();
    const svc = new CanvaService(prisma, config(CONFIGURED));
    rows.push({
      id: 'c1',
      userId: 'u1',
      accessToken: null,
      refreshToken: svc.seal('rt-1'),
      expiresAt: null,
      scope: null,
      pendingState: null,
      pendingVerifier: null,
      pendingExpiresAt: null,
    });
    fetchMock.mockResolvedValue(jsonResponse(400, { error: 'invalid_grant' }));
    await expect(svc.accessToken('u1')).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(rows[0].refreshToken).toBeNull();
  });

  it('keeps the connection when Canva is only unreachable', async () => {
    const { prisma, rows } = fakePrisma();
    const svc = new CanvaService(prisma, config(CONFIGURED));
    rows.push({
      id: 'c1',
      userId: 'u1',
      accessToken: null,
      refreshToken: svc.seal('rt-1'),
      expiresAt: null,
      scope: null,
      pendingState: null,
      pendingVerifier: null,
      pendingExpiresAt: null,
    });
    fetchMock.mockResolvedValue(jsonResponse(503, {}));
    await expect(svc.accessToken('u1')).rejects.toThrow("Couldn't reach Canva");
    expect(rows[0].refreshToken).not.toBeNull();
  });

  it('sends the file to the design import with a base64 title and reads the job back', async () => {
    const { prisma, rows } = fakePrisma();
    const svc = new CanvaService(prisma, config(CONFIGURED));
    rows.push({
      id: 'c1',
      userId: 'u1',
      accessToken: svc.seal('at-1'),
      refreshToken: svc.seal('rt-1'),
      expiresAt: new Date(Date.now() + 3_600_000),
      scope: null,
      pendingState: null,
      pendingVerifier: null,
      pendingExpiresAt: null,
    });
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse(200, { job: { id: 'job-1', status: 'in_progress' } }),
      )
      .mockResolvedValueOnce(
        jsonResponse(200, {
          job: {
            id: 'job-1',
            status: 'success',
            result: {
              designs: [
                {
                  urls: {
                    edit_url: 'https://canva.com/e',
                    view_url: 'https://canva.com/v',
                  },
                },
              ],
            },
          },
        }),
      );

    const title =
      '2026 Capabilities · a deck title that runs well past fifty characters long';
    await expect(
      svc.startImport('u1', Buffer.from('pptx-bytes'), title),
    ).resolves.toBe('job-1');
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${CANVA_API}/imports`);
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer at-1');
    expect(headers['Content-Type']).toBe('application/octet-stream');
    const meta = JSON.parse(headers['Import-Metadata']) as {
      title_base64: string;
      mime_type: string;
    };
    expect(meta.mime_type).toBe(PPTX_MIME);
    expect(Buffer.from(meta.title_base64, 'base64').toString('utf8')).toBe(
      [...title].slice(0, 50).join(''),
    );

    await expect(svc.importJob('u1', 'job-1')).resolves.toEqual({
      status: 'success',
      editUrl: 'https://canva.com/e',
      viewUrl: 'https://canva.com/v',
      error: undefined,
    });
    expect(calls()[1][0]).toBe(`${CANVA_API}/imports/job-1`);
  });

  it('asks the admin to connect before importing', async () => {
    const svc = new CanvaService(fakePrisma().prisma, config(CONFIGURED));
    await expect(
      svc.startImport('u1', Buffer.from('x'), 'Deck'),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
