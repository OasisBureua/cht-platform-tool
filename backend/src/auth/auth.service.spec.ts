import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { UserRole } from '@prisma/client';

describe('AuthService', () => {
  let service: AuthService;
  let prisma: PrismaService;

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
            },
          },
        },
        {
          provide: ConfigService,
          useValue: { get: jest.fn((key: string) => (key === 'sessionTtlSeconds' ? 1800 : undefined)) },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  describe('findOrCreateByAuthId', () => {
    it('should create user when not in DB', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.user.create as jest.Mock).mockResolvedValue(mockUser);

      const result = await service.findOrCreateByAuthId(mockUser.authId, mockUser.email);

      expect(result?.userId).toBe(mockUser.id);
      expect(prisma.user.create).toHaveBeenCalled();
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
});
