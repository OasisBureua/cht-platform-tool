import { BadRequestException } from '@nestjs/common';
import { PaymentsService } from './payments.service';

describe('PaymentsService payNow Stripe gates', () => {
  const prisma = {
    payment: {
      findUnique: jest.fn(),
      updateMany: jest.fn(),
      update: jest.fn(),
    },
    programRegistration: {
      findUnique: jest.fn(),
    },
    user: {
      update: jest.fn(),
    },
  };

  const billService = {};
  const stripeService = {
    isConfigured: jest.fn(),
    retrieveAccount: jest.fn(),
    summarizeAccount: jest.fn(),
    createTransfer: jest.fn(),
  };
  const configService = {
    get: jest.fn().mockReturnValue('http://localhost:5173'),
  };

  let service: PaymentsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new PaymentsService(
      prisma as never,
      billService as never,
      stripeService as never,
      configService as never,
    );
  });

  it('blocks payNow when Stripe configured but no Connect account', async () => {
    stripeService.isConfigured.mockReturnValue(true);
    prisma.payment.findUnique.mockResolvedValue({
      id: 'pay_1',
      userId: 'u1',
      programId: null,
      type: 'HONORARIUM',
      status: 'PENDING',
      amount: 1000,
      description: 'test',
      user: {
        id: 'u1',
        stripeAccountId: null,
        stripePayoutsEnabled: false,
        w9Submitted: false,
        paymentEnabled: false,
      },
    });

    await expect(service.payNow('pay_1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(service.payNow('pay_1')).rejects.toThrow(/Stripe Connect/);
  });

  it('creates Stripe transfer when account is ready', async () => {
    stripeService.isConfigured.mockReturnValue(true);
    prisma.payment.findUnique.mockResolvedValue({
      id: 'pay_1',
      userId: 'u1',
      programId: null,
      type: 'HONORARIUM',
      status: 'PENDING',
      amount: 2500,
      description: 'honorarium',
      user: {
        id: 'u1',
        stripeAccountId: 'acct_1',
        stripePayoutsEnabled: true,
        w9Submitted: true,
        paymentEnabled: true,
      },
    });
    stripeService.retrieveAccount.mockResolvedValue({ id: 'acct_1' });
    stripeService.summarizeAccount.mockReturnValue({
      id: 'acct_1',
      payoutsEnabled: true,
      detailsSubmitted: true,
      chargesEnabled: false,
      currentlyDue: [],
      taxComplete: true,
      status: 'active',
      bankAccountLast4: '4242',
    });
    prisma.user.update.mockResolvedValue({});
    prisma.payment.updateMany.mockResolvedValue({ count: 1 });
    stripeService.createTransfer.mockResolvedValue({ id: 'tr_abc' });
    prisma.payment.update.mockResolvedValue({});

    const result = await service.payNow('pay_1');

    expect(stripeService.createTransfer).toHaveBeenCalledWith(
      expect.objectContaining({
        amountCents: 2500,
        destinationAccountId: 'acct_1',
        paymentId: 'pay_1',
      }),
    );
    expect(result).toEqual(
      expect.objectContaining({
        paymentId: 'pay_1',
        status: 'PAID',
        transferId: 'tr_abc',
      }),
    );
  });

  it('blocks payNow when Stripe taxComplete is false even if legacy w9Submitted true', async () => {
    stripeService.isConfigured.mockReturnValue(true);
    prisma.payment.findUnique.mockResolvedValue({
      id: 'pay_1',
      userId: 'u1',
      programId: null,
      type: 'HONORARIUM',
      status: 'PENDING',
      amount: 1000,
      description: 'test',
      user: {
        id: 'u1',
        stripeAccountId: 'acct_1',
        stripePayoutsEnabled: true,
        w9Submitted: true,
        paymentEnabled: true,
      },
    });
    stripeService.retrieveAccount.mockResolvedValue({ id: 'acct_1' });
    stripeService.summarizeAccount.mockReturnValue({
      id: 'acct_1',
      payoutsEnabled: true,
      detailsSubmitted: true,
      chargesEnabled: false,
      currentlyDue: ['individual.id_number'],
      taxComplete: false,
      status: 'pending',
      bankAccountLast4: null,
    });

    await expect(service.payNow('pay_1')).rejects.toThrow(/tax \/ W-9/);
  });
});
