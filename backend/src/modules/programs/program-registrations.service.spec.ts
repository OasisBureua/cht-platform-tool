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
          }) as unknown,
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

  describe('listRegistrationsForAdmin', () => {
    it('selects institution and role alongside the existing user fields', async () => {
      prisma.programRegistration.findMany.mockResolvedValue([]);

      await service.listRegistrationsForAdmin('program-1');

      expect(prisma.programRegistration.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          include: expect.objectContaining({
            user: expect.objectContaining({
              select: expect.objectContaining({
                specialty: true,
                institution: true,
                role: true,
              }) as unknown,
            }) as unknown,
          }) as unknown,
        }),
      );
    });
  });

  describe('getMyPostEventProgress', () => {
    const NOW = new Date('2026-10-30T12:00:00.000Z').getTime();
    const ended = new Date('2026-10-30T00:21:00.000Z');

    const reg = (
      programId: string,
      over: Record<string, unknown> = {},
      program: Record<string, unknown> = {},
    ) => ({
      programId,
      postEventAttendanceStatus: 'VERIFIED',
      postEventSurveyAcknowledgedAt: null,
      honorariumRequestedAt: null,
      payoutDetailsConfirmedAt: null,
      ...over,
      program: {
        id: programId,
        title: `Session ${programId}`,
        zoomSessionType: 'WEBINAR',
        startDate: new Date('2026-10-30T00:00:00.000Z'),
        duration: 15,
        zoomSessionEndedAt: ended,
        jotformSurveyUrl: null,
        ...program,
      },
    });

    function build(data: {
      regs: unknown[];
      surveys?: unknown[];
      payments?: unknown[];
      responses?: unknown[];
      user?: unknown;
    }) {
      const rich = {
        programRegistration: {
          findMany: jest.fn().mockResolvedValue(data.regs),
        },
        survey: { findMany: jest.fn().mockResolvedValue(data.surveys ?? []) },
        payment: { findMany: jest.fn().mockResolvedValue(data.payments ?? []) },
        surveyResponse: {
          findMany: jest.fn().mockResolvedValue(data.responses ?? []),
        },
        user: {
          findUnique: jest.fn().mockResolvedValue(
            data.user ?? {
              stripeAccountId: 'acct_1',
              stripePayoutsEnabled: true,
              w9Submitted: true,
            },
          ),
        },
      };
      const svc = new ProgramRegistrationsService(
        rich as unknown as PrismaService,
        {} as OutboundSyncService,
        { get: jest.fn() } as unknown as ConfigService,
        {} as QueueService,
        {} as SesEmailService,
        {} as import('../invites/invites.service').InvitesService,
      );
      return { svc, rich };
    }

    it('only asks for approved, non-denied registrations on paid live sessions', async () => {
      const { svc, rich } = build({ regs: [] });
      await expect(svc.getMyPostEventProgress('u1', NOW)).resolves.toEqual([]);
      const [args] = rich.programRegistration.findMany.mock.calls[0] as [
        { where: Record<string, unknown> },
      ];
      expect(args.where).toMatchObject({
        userId: 'u1',
        status: ProgramRegistrationStatus.APPROVED,
        postEventAttendanceStatus: { not: 'DENIED' },
        program: expect.objectContaining({
          honorariumAmount: { gt: 0 },
        }) as unknown,
      });
    });

    it('returns the step facts for a session with a saved survey draft', async () => {
      const { svc } = build({
        regs: [reg('p1')],
        surveys: [{ id: 's1', programId: 'p1' }],
        responses: [{ surveyId: 's1', isDraft: true }],
      });
      const [item] = await svc.getMyPostEventProgress('u1', NOW);
      expect(item).toEqual({
        programId: 'p1',
        title: 'Session p1',
        zoomSessionType: 'WEBINAR',
        startDate: '2026-10-30T00:00:00.000Z',
        hasSurvey: true,
        hasHonorarium: true,
        nativeSurvey: true,
        feedbackSurveyId: 's1',
        attendance: 'VERIFIED',
        surveyAcknowledged: false,
        surveySubmitted: false,
        surveyDraftSaved: true,
        paymentInfoConfirmed: false,
        paymentStatus: null,
        payoutReady: true,
      });
    });

    it('drops paid and cancelled honoraria but keeps pending and failed ones', async () => {
      const { svc } = build({
        regs: [reg('paid'), reg('cancelled'), reg('pending'), reg('failed')],
        payments: [
          { programId: 'paid', status: 'PAID' },
          { programId: 'cancelled', status: 'CANCELLED' },
          { programId: 'pending', status: 'PENDING' },
          { programId: 'failed', status: 'FAILED' },
        ],
      });
      const items = await svc.getMyPostEventProgress('u1', NOW);
      expect(
        items.map((i) => [
          i.programId,
          i.paymentStatus,
          i.paymentInfoConfirmed,
        ]),
      ).toEqual([
        ['pending', 'PENDING', true],
        ['failed', 'FAILED', true],
      ]);
    });

    it('uses the latest honorarium payment per session', async () => {
      const { svc } = build({
        regs: [reg('p1')],
        payments: [
          { programId: 'p1', status: 'PROCESSING' },
          { programId: 'p1', status: 'FAILED' },
        ],
      });
      const [item] = await svc.getMyPostEventProgress('u1', NOW);
      expect(item.paymentStatus).toBe('PROCESSING');
    });

    it('skips sessions that have not ended yet', async () => {
      const { svc } = build({
        regs: [
          reg(
            'later',
            {},
            {
              zoomSessionEndedAt: null,
              startDate: new Date('2026-11-05T00:00:00.000Z'),
            },
          ),
        ],
      });
      await expect(svc.getMyPostEventProgress('u1', NOW)).resolves.toEqual([]);
    });

    it('skips an untouched survey after its window closed, but keeps one already saved', async () => {
      const longAgo = new Date('2026-10-01T00:00:00.000Z');
      const { svc } = build({
        regs: [
          reg(
            'closed',
            {},
            { zoomSessionEndedAt: longAgo, startDate: longAgo },
          ),
          reg('saved', {}, { zoomSessionEndedAt: longAgo, startDate: longAgo }),
        ],
        surveys: [
          { id: 's-closed', programId: 'closed' },
          { id: 's-saved', programId: 'saved' },
        ],
        responses: [{ surveyId: 's-saved', isDraft: false }],
      });
      const items = await svc.getMyPostEventProgress('u1', NOW);
      expect(items.map((i) => [i.programId, i.surveySubmitted])).toEqual([
        ['saved', true],
      ]);
    });

    it('reports payout details as missing when Stripe is not ready', async () => {
      const { svc } = build({
        regs: [reg('p1', { postEventSurveyAcknowledgedAt: ended })],
        user: {
          stripeAccountId: 'acct_1',
          stripePayoutsEnabled: false,
          w9Submitted: true,
        },
      });
      const [item] = await svc.getMyPostEventProgress('u1', NOW);
      expect(item.payoutReady).toBe(false);
      expect(item.surveyAcknowledged).toBe(true);
      expect(item.hasSurvey).toBe(false);
    });
  });
});
