import { GoneException, NotFoundException } from '@nestjs/common';
import { InvitesService } from './invites.service';

/**
 * SCRUM-175: token lifecycle for the unregistered-invite flow.
 * The service creates opaque tokens, resolves them to `{ email, programIds }`
 * on lookup, and rejects expired or already-consumed tokens.
 */
describe('InvitesService', () => {
  type InviteRow = {
    id: string;
    token: string;
    email: string;
    programIds: string[];
    createdAt: Date;
    expiresAt: Date;
    usedAt: Date | null;
    createdByAdminId: string | null;
  };

  function buildService(seed: InviteRow[] = []): InvitesService {
    const rows: InviteRow[] = [...seed];
    const prisma = {
      registrationInvite: {
        create: ({ data }: { data: Omit<InviteRow, 'id' | 'createdAt' | 'usedAt'> & { usedAt?: null } }) => {
          const row: InviteRow = {
            id: `cuid-${rows.length + 1}`,
            createdAt: new Date(),
            usedAt: null,
            ...data,
          } as InviteRow;
          rows.push(row);
          return Promise.resolve(row);
        },
        findUnique: ({ where: { token } }: { where: { token: string } }) =>
          Promise.resolve(rows.find((r) => r.token === token) ?? null),
        updateMany: ({
          where,
          data,
        }: {
          where: { token: string; usedAt: null };
          data: { usedAt: Date };
        }) => {
          let n = 0;
          for (const r of rows) {
            if (r.token === where.token && r.usedAt === null) {
              r.usedAt = data.usedAt;
              n += 1;
            }
          }
          return Promise.resolve({ count: n });
        },
      },
    };
    return new InvitesService(
      prisma as unknown as ConstructorParameters<typeof InvitesService>[0],
    );
  }

  it('creates an invite and returns a token + expiresAt', async () => {
    const svc = buildService();
    const { token, expiresAt } = await svc.createInvite({
      email: 'jane@example.com',
      programIds: ['prog_a'],
    });
    expect(token).toMatch(/^[A-Za-z0-9_-]{20,}$/);
    expect(expiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  it('lowercases and trims the email on create', async () => {
    const svc = buildService();
    const { token } = await svc.createInvite({
      email: '  JANE@Example.com  ',
      programIds: ['prog_a'],
    });
    const resolved = await svc.resolveInvite(token);
    expect(resolved.email).toBe('jane@example.com');
  });

  it('resolves a valid token to email + programIds', async () => {
    const svc = buildService();
    const { token } = await svc.createInvite({
      email: 'bob@example.com',
      programIds: ['prog_a', 'prog_b'],
    });
    await expect(svc.resolveInvite(token)).resolves.toEqual({
      email: 'bob@example.com',
      programIds: ['prog_a', 'prog_b'],
    });
  });

  it('throws NotFoundException for an unknown token', async () => {
    const svc = buildService();
    await expect(svc.resolveInvite('not-a-real-token')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('throws GoneException when the token is expired', async () => {
    const svc = buildService([
      {
        id: 'cuid-expired',
        token: 'expired-token',
        email: 'x@example.com',
        programIds: ['p1'],
        createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        expiresAt: new Date(Date.now() - 1000),
        usedAt: null,
        createdByAdminId: null,
      },
    ]);
    await expect(svc.resolveInvite('expired-token')).rejects.toBeInstanceOf(
      GoneException,
    );
  });

  it('throws GoneException when the token has been consumed', async () => {
    const svc = buildService();
    const { token } = await svc.createInvite({
      email: 'used@example.com',
      programIds: ['p1'],
    });
    await svc.consumeInvite(token);
    await expect(svc.resolveInvite(token)).rejects.toBeInstanceOf(
      GoneException,
    );
  });

  it('consumeInvite is idempotent and safe on unknown tokens', async () => {
    const svc = buildService();
    await expect(svc.consumeInvite('never-existed')).resolves.toBeUndefined();
    const { token } = await svc.createInvite({
      email: 'x@example.com',
      programIds: ['p1'],
    });
    await svc.consumeInvite(token);
    await svc.consumeInvite(token);
  });

  it('tokens are unique across many creates', async () => {
    const svc = buildService();
    const tokens = new Set<string>();
    for (let i = 0; i < 200; i++) {
      const { token } = await svc.createInvite({
        email: `u${i}@example.com`,
        programIds: ['p1'],
      });
      tokens.add(token);
    }
    expect(tokens.size).toBe(200);
  });
});
