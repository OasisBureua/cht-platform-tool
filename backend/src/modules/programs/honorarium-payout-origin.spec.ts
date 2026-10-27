import { PayoutDetailsOrigin, ProgramRegistrationStatus, PostEventAttendanceStatus } from '@prisma/client';
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
    prisma.programRegistration.count.mockResolvedValue(0);
    prisma.payment.count.mockResolvedValue(0);
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

  it('stores new when this is the first honorarium confirmation', async () => {
    const result = await service.requestPostEventHonorariumPayout('user-1', 'prog-1');
    expect(result).toEqual({ paymentId: null, created: true });
    expect(prisma.payment.count).toHaveBeenCalled();
    expect(prisma.programRegistration.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          payoutDetailsOrigin: PayoutDetailsOrigin.NEW,
        }),
      }),
    );
  });

  it('stores reused when a prior honorarium request already used the Stripe account', async () => {
    prisma.programRegistration.count.mockResolvedValue(1);
    await service.requestPostEventHonorariumPayout('user-1', 'prog-1');
    expect(prisma.payment.count).not.toHaveBeenCalled();
    expect(prisma.programRegistration.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          payoutDetailsOrigin: PayoutDetailsOrigin.REUSED,
        }),
      }),
    );
  });

  it('stores reused when a prior honorarium payment exists without a request timestamp', async () => {
    prisma.payment.count.mockResolvedValue(1);
    await service.requestPostEventHonorariumPayout('user-1', 'prog-1');
    expect(prisma.programRegistration.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          payoutDetailsOrigin: PayoutDetailsOrigin.REUSED,
        }),
      }),
    );
  });

  it('clears the origin when the payout cannot be queued', async () => {
    queueService.processPayment.mockResolvedValue(false);
    await expect(
      service.requestPostEventHonorariumPayout('user-1', 'prog-1'),
    ).rejects.toThrow('Could not queue honorarium');
    expect(prisma.programRegistration.update).toHaveBeenCalledWith({
      where: { id: 'reg-1' },
      data: { honorariumRequestedAt: null, payoutDetailsOrigin: null },
    });
  });

  it('does not overwrite origin when the honorarium was already requested', async () => {
    prisma.programRegistration.findUnique.mockResolvedValue({
      ...registration,
      honorariumRequestedAt: new Date('2026-10-02T00:00:00.000Z'),
    });
    prisma.payment.findFirst.mockResolvedValue({ id: 'pay-1' });
    const result = await service.requestPostEventHonorariumPayout('user-1', 'prog-1');
    expect(result).toEqual({ paymentId: 'pay-1', created: false, alreadyRequested: true });
    expect(prisma.programRegistration.updateMany).not.toHaveBeenCalled();
  });
});
