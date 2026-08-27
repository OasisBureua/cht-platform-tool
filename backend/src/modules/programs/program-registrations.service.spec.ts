import { NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ProgramRegistrationStatus } from '@prisma/client';
import { ProgramRegistrationsService } from './program-registrations.service';
import { PrismaService } from '../../prisma/prisma.service';
import { OutboundSyncService } from '../outbound-sync/outbound-sync.service';
import { SesEmailService } from '../email/ses-email.service';
import { QueueService } from '../../queue/queue.service';

describe('ProgramRegistrationsService', () => {
  let service: ProgramRegistrationsService;
  let prisma: {
    programRegistration: {
      findUnique: jest.Mock;
      findMany: jest.Mock;
    };
  };

  beforeEach(() => {
    prisma = {
      programRegistration: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
      },
    };

    service = new ProgramRegistrationsService(
      prisma as unknown as PrismaService,
      {} as OutboundSyncService,
      { get: jest.fn() } as unknown as ConfigService,
      {} as QueueService,
      {} as SesEmailService,
      {} as import('../invites/invites.service').InvitesService,
    );
  });

  describe('APPROVAL_UNDO_WINDOW_MS', () => {
    it('is 15 minutes', () => {
      expect(ProgramRegistrationsService.APPROVAL_UNDO_WINDOW_MS).toBe(
        15 * 60 * 1000,
      );
    });
  });

  describe('intervalsOverlap', () => {
    const t = (iso: string) => new Date(iso);

    it('detects identical windows as overlapping', () => {
      expect(
        ProgramRegistrationsService.intervalsOverlap(
          t('2026-08-10T15:00:00.000Z'),
          t('2026-08-10T16:00:00.000Z'),
          t('2026-08-10T15:00:00.000Z'),
          t('2026-08-10T16:00:00.000Z'),
        ),
      ).toBe(true);
    });

    it('detects partial overlap', () => {
      expect(
        ProgramRegistrationsService.intervalsOverlap(
          t('2026-08-10T15:00:00.000Z'),
          t('2026-08-10T16:00:00.000Z'),
          t('2026-08-10T15:30:00.000Z'),
          t('2026-08-10T16:30:00.000Z'),
        ),
      ).toBe(true);
    });

    it('allows back-to-back sessions that only touch at the boundary', () => {
      expect(
        ProgramRegistrationsService.intervalsOverlap(
          t('2026-08-10T15:00:00.000Z'),
          t('2026-08-10T16:00:00.000Z'),
          t('2026-08-10T16:00:00.000Z'),
          t('2026-08-10T17:00:00.000Z'),
        ),
      ).toBe(false);
    });

    it('allows fully separate sessions', () => {
      expect(
        ProgramRegistrationsService.intervalsOverlap(
          t('2026-08-10T15:00:00.000Z'),
          t('2026-08-10T16:00:00.000Z'),
          t('2026-08-10T17:00:00.000Z'),
          t('2026-08-10T18:00:00.000Z'),
        ),
      ).toBe(false);
    });
  });

  describe('adminUndoRegistrationApproval', () => {
    it('throws when registration is missing', async () => {
      prisma.programRegistration.findUnique.mockResolvedValue(null);
      await expect(
        service.adminUndoRegistrationApproval('admin-1', 'reg-1'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws when registration is not approved', async () => {
      prisma.programRegistration.findUnique.mockResolvedValue({
        id: 'reg-1',
        status: ProgramRegistrationStatus.PENDING,
        reviewedAt: new Date(),
      });
      await expect(
        service.adminUndoRegistrationApproval('admin-1', 'reg-1'),
      ).rejects.toThrow('Only approved registrations can be undone.');
    });

    it('throws when approval has no reviewedAt timestamp', async () => {
      prisma.programRegistration.findUnique.mockResolvedValue({
        id: 'reg-1',
        status: ProgramRegistrationStatus.APPROVED,
        reviewedAt: null,
      });
      await expect(
        service.adminUndoRegistrationApproval('admin-1', 'reg-1'),
      ).rejects.toThrow('Registration has no approval timestamp.');
    });

    it('throws when undo window has expired', async () => {
      const reviewedAt = new Date(
        Date.now() - ProgramRegistrationsService.APPROVAL_UNDO_WINDOW_MS - 1000,
      );
      prisma.programRegistration.findUnique.mockResolvedValue({
        id: 'reg-1',
        status: ProgramRegistrationStatus.APPROVED,
        reviewedAt,
      });
      await expect(
        service.adminUndoRegistrationApproval('admin-1', 'reg-1'),
      ).rejects.toThrow(
        'Undo window expired. Approvals can only be undone within 15 minutes.',
      );
    });

    it('delegates to adminSetRegistrationStatus within the undo window', async () => {
      const reviewedAt = new Date(Date.now() - 5 * 60 * 1000);
      prisma.programRegistration.findUnique.mockResolvedValue({
        id: 'reg-1',
        status: ProgramRegistrationStatus.APPROVED,
        reviewedAt,
      });
      const spy = jest
        .spyOn(service, 'adminSetRegistrationStatus')
        .mockResolvedValue({ id: 'reg-1' } as never);

      await service.adminUndoRegistrationApproval('admin-1', 'reg-1');

      expect(spy).toHaveBeenCalledWith(
        'admin-1',
        'reg-1',
        ProgramRegistrationStatus.PENDING,
        'Approval undone by admin',
      );
    });
  });

  describe('listRecentlyApprovedRegistrationsForAdminUndo', () => {
    it('queries approved registrations and filters by session visibility', async () => {
      const futureStart = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      prisma.programRegistration.findMany.mockResolvedValue([
        {
          id: 'reg-visible',
          reviewedAt: new Date(),
          program: { startDate: futureStart, duration: 60 },
        },
        {
          id: 'reg-expired',
          reviewedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          program: {
            startDate: new Date(Date.now() - 48 * 60 * 60 * 1000),
            duration: 60,
          },
        },
      ]);

      const rows =
        await service.listRecentlyApprovedRegistrationsForAdminUndo();

      expect(prisma.programRegistration.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: ProgramRegistrationStatus.APPROVED,
            reviewedAt: { not: null },
          }),
        }),
      );
      expect(rows.map((r) => r.id)).toEqual(['reg-visible']);
    });
  });

  describe('isRecentlyApprovedVisible', () => {
    it('stays visible until session end plus one hour', () => {
      const start = new Date('2026-06-01T18:00:00Z');
      const during = new Date('2026-06-01T19:30:00Z').getTime();
      expect(
        ProgramRegistrationsService.isRecentlyApprovedVisible(
          new Date('2026-06-01T10:00:00Z'),
          start,
          60,
          during,
        ),
      ).toBe(true);

      const after = new Date('2026-06-01T20:05:00Z').getTime();
      expect(
        ProgramRegistrationsService.isRecentlyApprovedVisible(
          new Date('2026-06-01T10:00:00Z'),
          start,
          60,
          after,
        ),
      ).toBe(false);
    });
  });
});
