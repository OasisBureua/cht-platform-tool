import { PayoutDetailsEntryKind, ProgramRegistrationStatus, PostEventAttendanceStatus } from '@prisma/client';
import { ProgramRegistrationsService } from './program-registrations.service';

describe('ProgramRegistrationsService.requestPostEventHonorariumPayout origin', () => {
  const prisma = {
    program: { findUnique: jest.fn() },
    programRegistration: {
      findUnique: jest.fn(),
      count: jest.fn(),
      updateMany: jest.fn(),
      update: jest.fn(),
    },
    user: { findUnique: jest.fn() },
    payment: { count: jest.fn(), findFirst: jest.fn() },
    survey: { count: jest.fn() },
  };
  const queueService = { processPayment: jest.fn() };
  let service: ProgramRegistrationsService;

  const program = {
    honorariumAmount: 50_000,
    jotformSurveyUrl: null,
    zoomSessionType: 'WEBINAR',
    startDate: new Date('2020-01-01T00:00:00.000Z'),
    duration: 60,
    zoomSessionEndedAt: new Date('2020-01-01T02:00:00.000Z'),
  };
  const registration = {
    id: 'reg-1',
    status: ProgramRegistrationStatus.APPROVED,
    postEventAttendanceStatus: PostEventAttendanceStatus.VERIFIED,
    postEventSurveyAcknowledgedAt: new Date('2026-10-01T00:00:00.000Z'),
    honorariumRequestedAt: null,
    payoutDetailsEntryKind: null,
  };
  const user = {
    firstName: 'Ada',
    lastName: 'Lovelace',
    specialty: 'Industry',
    npiNumber: null,
    phoneNumber: '+15555550100',
    stripeAccountId: 'acct_123',
    stripePayoutsEnabled: true,
    w9Submitted: true,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.program.findUnique.mockResolvedValue(program);
    prisma.programRegistration.findUnique.mockResolvedValue(registration);
    prisma.user.findUnique.mockResolvedValue(user);
    prisma.survey.count.mockResolvedValue(0);
    prisma.programRegistration.updateMany.mockResolvedValue({ count: 1 });
    queueService.processPayment.mockResolvedValue(true);
    service = new ProgramRegistrationsService(
      prisma as never,
      {} as never,
      {} as never,
      queueService as never,
      {} as never,
      {} as never,
    );
  });

  it('stores reused when the learner confirms existing payout details', async () => {
    const result = await service.requestPostEventHonorariumPayout('user-1', 'prog-1');
    expect(result).toEqual({
      paymentId: null,
      created: true,
      entryKind: PayoutDetailsEntryKind.REUSED,
    });
    expect(prisma.programRegistration.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          payoutDetailsEntryKind: PayoutDetailsEntryKind.REUSED,
          payoutDetailsConfirmedAt: expect.any(Date),
        }),
      }),
    );
  });

  it('stores newly entered when the learner updated payout details in this flow', async () => {
    await service.requestPostEventHonorariumPayout('user-1', 'prog-1', {
      entryKind: PayoutDetailsEntryKind.NEWLY_ENTERED,
    });
    expect(prisma.programRegistration.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          payoutDetailsEntryKind: PayoutDetailsEntryKind.NEWLY_ENTERED,
        }),
      }),
    );
  });

  it('clears the confirmation when the payout cannot be queued', async () => {
    queueService.processPayment.mockResolvedValue(false);
    await expect(
      service.requestPostEventHonorariumPayout('user-1', 'prog-1'),
    ).rejects.toThrow('Could not queue honorarium');
    expect(prisma.programRegistration.update).toHaveBeenCalledWith({
      where: { id: 'reg-1' },
      data: {
        honorariumRequestedAt: null,
        payoutDetailsConfirmedAt: null,
        payoutDetailsEntryKind: null,
      },
    });
  });

  it('does not overwrite the confirmation when the honorarium was already requested', async () => {
    prisma.programRegistration.findUnique.mockResolvedValue({
      ...registration,
      honorariumRequestedAt: new Date('2026-10-02T00:00:00.000Z'),
      payoutDetailsEntryKind: PayoutDetailsEntryKind.NEWLY_ENTERED,
    });
    prisma.payment.findFirst.mockResolvedValue({ id: 'pay-1' });
    const result = await service.requestPostEventHonorariumPayout('user-1', 'prog-1');
    expect(result).toEqual({ paymentId: 'pay-1', created: false, alreadyRequested: true });
    expect(prisma.programRegistration.updateMany).not.toHaveBeenCalled();
  });
});
