import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { CognitoService } from './cognito.service';
import { PrismaService } from '../prisma/prisma.service';
import { OutboundSyncService } from '../modules/outbound-sync/outbound-sync.service';
import { RedisCacheService } from '../cache/redis-cache.service';
import { UserRole } from '@prisma/client';

describe('AuthService', () => {
  let service: AuthService;
  let prisma: PrismaService;
  let cache: {
    getJson: jest.Mock;
    setJson: jest.Mock;
    del: jest.Mock;
  };

  const mockUser = {
    id: 'user-1',
    authId: 'auth0|123',
    email: 'test@example.com',
    firstName: 'Test',
    lastName: 'User',
    role: UserRole.HCP,
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: PrismaService,
          useValue: {
            user: {
              findUnique: jest.fn(),
              findFirst: jest.fn(),
              create: jest.fn(),
              update: jest.fn(),
            },
            session: {
              updateMany: jest.fn(),
              findMany: jest.fn().mockResolvedValue([]),
              create: jest.fn(),
              findUnique: jest.fn(),
              deleteMany: jest.fn(),
              delete: jest.fn(),
              update: jest.fn(),
            },
          },
        },
        {
          provide: CognitoService,
          useValue: {
            isConfigured: jest.fn().mockReturnValue(false),
            syncGroupsForRole: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'sessionTtlSeconds') return 1800;
              if (key === 'sessionAbsoluteTtlSeconds') return 28800;
              return undefined;
            }),
          },
        },
        {
          provide: OutboundSyncService,
          useValue: {
            syncUser: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: RedisCacheService,
          useValue: {
            getJson: jest.fn().mockResolvedValue(null),
            setJson: jest.fn().mockResolvedValue(undefined),
            del: jest.fn().mockResolvedValue(undefined),
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    prisma = module.get<PrismaService>(PrismaService);
    cache = module.get(RedisCacheService);
  });

  describe('findOrCreateByAuthId', () => {
    it('should create user when not in DB', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.user.create as jest.Mock).mockResolvedValue(mockUser);

      const result = await service.findOrCreateByAuthId(
        mockUser.authId,
        mockUser.email,
      );

      expect(result?.userId).toBe(mockUser.id);
      expect(prisma.user.create).toHaveBeenCalled();
    });

    it('should link existing user by email when authId changes', async () => {
      const existing = { ...mockUser, authId: 'old-cognito-sub' };
      (prisma.user.findUnique as jest.Mock).mockImplementation(
        ({ where }: { where: { authId?: string; email?: string } }) => {
          if (where.authId === mockUser.authId) return null;
          if (where.email === mockUser.email) return existing;
          return null;
        },
      );
      (prisma.user.update as jest.Mock).mockResolvedValue(mockUser);

      const result = await service.findOrCreateByAuthId(
        mockUser.authId,
        mockUser.email,
      );

      expect(result?.userId).toBe(mockUser.id);
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: existing.id },
        data: { authId: mockUser.authId },
      });
      expect(prisma.user.create).not.toHaveBeenCalled();
    });

    it('should return existing user from DB', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);

      const result = await service.findOrCreateByAuthId(mockUser.authId);

      expect(result?.userId).toBe(mockUser.id);
      expect(prisma.user.create).not.toHaveBeenCalled();
    });
  });

  describe('findByUserId', () => {
    it('should return user when found', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);

      const result = await service.findByUserId(mockUser.id);

      expect(result).toBeDefined();
      expect(result?.userId).toBe(mockUser.id);
    });

    it('should return null when user not found', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await service.findByUserId('unknown');

      expect(result).toBeNull();
    });
  });

  describe('session cache', () => {
    it('createSession writes Redis with session TTL', async () => {
      (prisma.session.create as jest.Mock).mockResolvedValue({});
      const authUser = {
        authId: mockUser.authId,
        userId: mockUser.id,
        email: mockUser.email,
        name: 'Test User',
        role: UserRole.HCP,
      };

      const token = await service.createSession(authUser as never);

      expect(prisma.session.create).toHaveBeenCalled();
      expect(cache.setJson).toHaveBeenCalledWith(
        `cht:session:${token}`,
        expect.objectContaining({
          userId: mockUser.id,
          email: mockUser.email,
          role: UserRole.HCP,
        }),
        expect.any(Number),
      );
      const ttl = cache.setJson.mock.calls[0][2] as number;
      expect(ttl).toBeGreaterThan(1700);
      expect(ttl).toBeLessThanOrEqual(1800);
    });

    it('getSession returns cached user without hitting Postgres', async () => {
      const createdAt = new Date(Date.now() - 60_000).toISOString();
      const expiresAt = new Date(Date.now() + 1800_000).toISOString();
      cache.getJson.mockResolvedValue({
        authId: mockUser.authId,
        userId: mockUser.id,
        email: mockUser.email,
        name: 'Test User',
        role: UserRole.HCP,
        expiresAt,
        createdAt,
      });

      const result = await service.getSession('tok-1');

      expect(result?.userId).toBe(mockUser.id);
      expect(prisma.session.findUnique).not.toHaveBeenCalled();
    });

    it('getSession rejects when absolute TTL has elapsed', async () => {
      const createdAt = new Date(Date.now() - 30_000_000).toISOString(); // > 8h ago
      const expiresAt = new Date(Date.now() + 1800_000).toISOString();
      cache.getJson.mockResolvedValue({
        authId: mockUser.authId,
        userId: mockUser.id,
        email: mockUser.email,
        name: 'Test User',
        role: UserRole.HCP,
        expiresAt,
        createdAt,
      });

      const result = await service.getSession('tok-abs');

      expect(result).toBeNull();
      expect(cache.del).toHaveBeenCalledWith('cht:session:tok-abs');
    });

    it('getSession slides idle expiry when less than half idle window remains', async () => {
      cache.getJson.mockResolvedValue(null);
      const createdAt = new Date(Date.now() - 60_000);
      const expiresAt = new Date(Date.now() + 5 * 60_000); // 5 min left of 30
      (prisma.session.findUnique as jest.Mock).mockResolvedValue({
        id: 'sess-1',
        token: 'tok-slide',
        authId: mockUser.authId,
        userId: mockUser.id,
        email: mockUser.email,
        name: 'Test User',
        role: UserRole.HCP,
        expiresAt,
        createdAt,
      });
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        role: UserRole.HCP,
      });
      (prisma.session.update as jest.Mock).mockResolvedValue({});

      const result = await service.getSession('tok-slide');

      expect(result?.userId).toBe(mockUser.id);
      expect(prisma.session.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'sess-1' },
          data: expect.objectContaining({
            expiresAt: expect.any(Date),
          }),
        }),
      );
    });

    it('revokeSession deletes DB row and Redis key', async () => {
      (prisma.session.deleteMany as jest.Mock).mockResolvedValue({ count: 1 });

      await service.revokeSession('tok-2');

      expect(prisma.session.deleteMany).toHaveBeenCalledWith({
        where: { token: 'tok-2' },
      });
      expect(cache.del).toHaveBeenCalledWith('cht:session:tok-2');
    });

    it('revokeAllUserSessions deletes Postgres rows and Redis keys', async () => {
      (prisma.session.findMany as jest.Mock).mockResolvedValue([
        { token: 'tok-a' },
        { token: 'tok-b' },
      ]);
      (prisma.session.deleteMany as jest.Mock).mockResolvedValue({ count: 2 });

      const count = await service.revokeAllUserSessions(mockUser.id);

      expect(count).toBe(2);
      expect(prisma.session.deleteMany).toHaveBeenCalledWith({
        where: { userId: mockUser.id },
      });
      expect(cache.del).toHaveBeenCalledWith('cht:session:tok-a');
      expect(cache.del).toHaveBeenCalledWith('cht:session:tok-b');
    });

    it('invalidateAuthCache only clears Redis (keeps Postgres sessions)', async () => {
      (prisma.session.findMany as jest.Mock).mockResolvedValue([
        { token: 'tok-a' },
      ]);

      await service.invalidateAuthCache(mockUser.id);

      expect(prisma.session.deleteMany).not.toHaveBeenCalled();
      expect(cache.del).toHaveBeenCalledWith('cht:session:tok-a');
    });
  });
});
