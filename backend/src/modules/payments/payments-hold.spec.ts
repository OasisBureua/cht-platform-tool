import { BadRequestException, NotFoundException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { PaymentsService } from './payments.service';
import type { AuthUser } from '../../auth/auth.service';

const actor: AuthUser = {
  authId: 'auth-1',
  userId: 'admin-1',
  email: 'admin@example.com',
  name: 'Admin',
  role: UserRole.ADMIN,
};

describe('PaymentsService hold and audit', () => {
  const prisma = {
    payment: {
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      create: jest.fn(),
    },
    user: { findUnique: jest.fn() },
    program: { findUnique: jest.fn() },
  };
  const stripeService = { isConfigured: jest.fn() };
  const configService = { get: jest.fn() };
  const audit = { record: jest.fn() };
  let service: PaymentsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new PaymentsService(
      prisma as never,
      stripeService as never,
      configService as never,
      audit as never,
    );
  });

  it('holds a pending payment with a reason and writes an audit row', async () => {
    prisma.payment.findUnique.mockResolvedValue({
      id: 'pay_1',
      status: 'PENDING',
      heldAt: null,
    });
    prisma.payment.update.mockResolvedValue({ id: 'pay_1', status: 'PENDING' });

    await service.holdPayment('pay_1', '  finance review  ', actor);

    expect(prisma.payment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          heldByUserId: 'admin-1',
          holdReason: 'finance review',
        }),
      }),
    );
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: 'admin-1',
        actorEmail: 'admin@example.com',
        actorRole: UserRole.ADMIN,
        action: 'payment.hold',
        resource: 'payment',
        resourceId: 'pay_1',
        metadata: { reason: 'finance review' },
      }),
    );
  });

  it('rejects hold without a reason, a second hold, and a non-pending payment', async () => {
    await expect(service.holdPayment('pay_1', '   ', actor)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    prisma.payment.findUnique.mockResolvedValue({
      id: 'pay_1',
      status: 'PENDING',
      heldAt: new Date(),
    });
    await expect(service.holdPayment('pay_1', 'again', actor)).rejects.toThrow(
      /already on hold/,
    );
    prisma.payment.findUnique.mockResolvedValue({
      id: 'pay_1',
      status: 'PAID',
      heldAt: null,
    });
    await expect(service.holdPayment('pay_1', 'nope', actor)).rejects.toThrow(
      /pending/,
    );
    expect(audit.record).not.toHaveBeenCalled();
  });

  it('releases a hold back to pending and audits it', async () => {
    prisma.payment.findUnique.mockResolvedValue({
      id: 'pay_1',
      status: 'PENDING',
      heldAt: new Date(),
      holdReason: 'finance review',
    });
    prisma.payment.update.mockResolvedValue({ id: 'pay_1' });

    await service.releaseHold('pay_1', actor);

    expect(prisma.payment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { heldAt: null, heldByUserId: null, holdReason: null },
      }),
    );
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'payment.release_hold',
        resourceId: 'pay_1',
        metadata: { previousReason: 'finance review' },
      }),
    );
  });

  it('blocks pay now while a payment is on hold and does not audit a release', async () => {
    prisma.payment.findUnique.mockResolvedValue({
      id: 'pay_1',
      status: 'PENDING',
      heldAt: new Date(),
      user: { id: 'u1' },
    });
    await expect(service.payNow('pay_1', actor)).rejects.toThrow(/on hold/);
    expect(stripeService.isConfigured).not.toHaveBeenCalled();
    expect(audit.record).not.toHaveBeenCalled();
  });

  it('audits delete and manual create', async () => {
    prisma.payment.findUnique.mockResolvedValue({
      id: 'pay_1',
      status: 'PENDING',
      userId: 'u1',
      programId: 'p1',
    });
    prisma.payment.delete.mockResolvedValue({});
    await service.deletePaymentById('pay_1', actor);
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'payment.delete', resourceId: 'pay_1' }),
    );

    audit.record.mockClear();
    prisma.user.findUnique.mockResolvedValue({ id: 'u1' });
    prisma.payment.create.mockResolvedValue({
      id: 'pay_new',
      userId: 'u1',
      programId: null,
      amount: 1000,
      type: 'HONORARIUM',
    });
    await service.createManualPendingPayment(
      { userId: 'u1', amount: 1000 },
      actor,
    );
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'payment.manual_create',
        resourceId: 'pay_new',
      }),
    );
  });

  it('does not audit a missing payment', async () => {
    prisma.payment.findUnique.mockResolvedValue(null);
    await expect(service.deletePaymentById('missing', actor)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(audit.record).not.toHaveBeenCalled();
  });

  it('holds two pending payments and reports the ineligible one', async () => {
    prisma.payment.findUnique.mockImplementation(async ({ where }: { where: { id: string } }) => {
      if (where.id === 'paid') return { id: 'paid', status: 'PAID', heldAt: null };
      return { id: where.id, status: 'PENDING', heldAt: null };
    });
    prisma.payment.update.mockImplementation(async ({ where }: { where: { id: string } }) => ({
      id: where.id,
      status: 'PENDING',
    }));

    const result = await service.bulkPayments(
      { action: 'hold', paymentIds: ['a', 'paid', 'b'], reason: 'finance review' },
      actor,
    );

    expect(result.results.map((row) => row.ok)).toEqual([true, false, true]);
    expect(result.results[1]?.error).toMatch(/pending/i);
    expect(audit.record).toHaveBeenCalledTimes(2);
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'payment.hold', resourceId: 'a' }),
    );
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'payment.hold', resourceId: 'b' }),
    );
  });

  it('does not hold anyone when the reason is missing', async () => {
    await expect(
      service.bulkPayments({ action: 'hold', paymentIds: ['a'], reason: '  ' }, actor),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.payment.update).not.toHaveBeenCalled();
    expect(audit.record).not.toHaveBeenCalled();
  });

  it('releases two payments and reports the one that cannot be paid', async () => {
    const payNow = jest.spyOn(service, 'payNow').mockImplementation(async (id) => {
      if (id === 'held') {
        throw new BadRequestException('Payment is on hold. Release the hold before paying.');
      }
      audit.record({
        actorId: actor.userId,
        action: 'payment.release',
        resource: 'payment',
        resourceId: id,
      });
      return { paymentId: id } as never;
    });

    const result = await service.bulkPayments(
      { action: 'release', paymentIds: ['a', 'held', 'b'] },
      actor,
    );

    expect(payNow).toHaveBeenCalledTimes(3);
    expect(result.results.map((row) => row.ok)).toEqual([true, false, true]);
    expect(result.results[1]?.error).toMatch(/on hold/i);
    expect(audit.record).toHaveBeenCalledTimes(2);
  });
});
