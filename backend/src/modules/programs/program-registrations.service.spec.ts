import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ProgramRegistrationStatus } from '@prisma/client';
import { ProgramRegistrationsService } from './program-registrations.service';
import { PrismaService } from '../../prisma/prisma.service';
import { HubSpotService } from '../hubspot/hubspot.service';
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
      {} as HubSpotService,
      { get: jest.fn() } as unknown as ConfigService,
      {} as QueueService,
      {} as SesEmailService,
    );
  });

  describe('APPROVAL_UNDO_WINDOW_MS', () => {
    it('is 15 minutes', () => {
      expect(ProgramRegistrationsService.APPROVAL_UNDO_WINDOW_MS).toBe(
        15 * 60 * 1000,
      );
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
      ).rejects.toThrow('Undo window expired. Approvals can only be undone within 15 minutes.');
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
    it('queries approvals since the undo window start', async () => {
      const now = Date.now();
      jest.spyOn(Date, 'now').mockReturnValue(now);
      prisma.programRegistration.findMany.mockResolvedValue([]);

      await service.listRecentlyApprovedRegistrationsForAdminUndo();

      expect(prisma.programRegistration.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: ProgramRegistrationStatus.APPROVED,
            reviewedAt: {
              gte: new Date(
                now - ProgramRegistrationsService.APPROVAL_UNDO_WINDOW_MS,
              ),
            },
          }),
        }),
      );

      jest.spyOn(Date, 'now').mockRestore();
    });
  });
});
