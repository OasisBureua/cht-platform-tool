import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { CognitoService } from './cognito.service';
import { PrismaService } from '../prisma/prisma.service';
import { OutboundSyncService } from '../modules/outbound-sync/outbound-sync.service';
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
              update: jest.fn(),
            },
            session: {
              updateMany: jest.fn(),
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
            get: jest.fn((key: string) =>
              key === 'sessionTtlSeconds' ? 1800 : undefined,
            ),
          },
        },
        {
          provide: OutboundSyncService,
          useValue: {
            syncUser: jest.fn().mockResolvedValue(undefined),
          },
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
});
