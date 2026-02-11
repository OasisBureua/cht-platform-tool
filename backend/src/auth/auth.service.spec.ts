import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { UserRole } from '@prisma/client';

describe('AuthService', () => {
  let service: AuthService;
  let prisma: PrismaService;
  let redis: RedisService;

  const mockUser = {
    id: 'user-1',
    authId: 'auth0|123',
    email: 'test@example.com',
    firstName: 'Test',
    lastName: 'User',
    role: UserRole.HCP,
  };

  const mockRedis = {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    keys: { authUser: (authId: string) => `auth:user:${authId}` },
    ttl: { user: 1800 },
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
            },
          },
        },
        {
          provide: RedisService,
          useValue: mockRedis,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    prisma = module.get<PrismaService>(PrismaService);
    redis = module.get<RedisService>(RedisService);
  });

  describe('findOrCreateByAuthId', () => {
    it('should return cached user from Redis when present', async () => {
      const cached = {
        authId: mockUser.authId,
        userId: mockUser.id,
        email: mockUser.email,
        name: 'Test User',
        role: mockUser.role,
      };
      (redis.get as jest.Mock).mockResolvedValue(cached);

      const result = await service.findOrCreateByAuthId(mockUser.authId);

      expect(result).toBeDefined();
      expect(result?.userId).toBe(mockUser.id);
      expect(result?.email).toBe(mockUser.email);
      expect(prisma.user.findUnique).not.toHaveBeenCalled();
    });

    it('should create user when not in cache and not in DB', async () => {
      (redis.get as jest.Mock).mockResolvedValue(null);
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.user.create as jest.Mock).mockResolvedValue(mockUser);

      const result = await service.findOrCreateByAuthId(mockUser.authId, mockUser.email);

      expect(result?.userId).toBe(mockUser.id);
      expect(prisma.user.create).toHaveBeenCalled();
    });

    it('should return existing user from DB when not cached', async () => {
      (redis.get as jest.Mock).mockResolvedValue(null);
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
});
