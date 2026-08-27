import { BadRequestException } from '@nestjs/common';
import { StripeWebhookService } from './stripe-webhook.service';
import { StripeService } from './stripe.service';

describe('StripeWebhookService', () => {
  const prisma = {
    user: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    payment: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
  };

  const stripeService = {
    constructEvent: jest.fn(),
    summarizeAccount: jest.fn(),
    retrieveAccount: jest.fn(),
  };

  let service: StripeWebhookService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new StripeWebhookService(
      prisma as never,
      stripeService as unknown as StripeService,
    );
  });

  it('maps transfer.updated to PAID and increments earnings once', async () => {
    stripeService.constructEvent.mockReturnValue({
      id: 'evt_1',
      type: 'transfer.updated',
      data: {
        object: {
          id: 'tr_1',
          amount: 10000,
          amount_reversed: 0,
          metadata: { paymentId: 'pay_1' },
        },
      },
    });
    prisma.payment.findUnique.mockResolvedValue({
      id: 'pay_1',
      userId: 'user_1',
      amount: 10000,
      status: 'PROCESSING',
      paidAt: null,
    });
    prisma.payment.update.mockResolvedValue({});
    prisma.user.update.mockResolvedValue({});

    await service.processEvent('{}', 'sig');

    expect(prisma.payment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'pay_1' },
        data: expect.objectContaining({
          status: 'PAID',
          stripeTransferId: 'tr_1',
        }),
      }),
    );
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'user_1' },
        data: { totalEarnings: { increment: 10000 } },
      }),
    );
  });

  it('maps transfer.reversed to FAILED', async () => {
    stripeService.constructEvent.mockReturnValue({
      id: 'evt_2',
      type: 'transfer.reversed',
      data: {
        object: {
          id: 'tr_2',
          metadata: { paymentId: 'pay_2' },
        },
      },
    });
    prisma.payment.findUnique.mockResolvedValue({
      id: 'pay_2',
      userId: 'user_1',
      amount: 5000,
      status: 'PAID',
    });
    prisma.payment.update.mockResolvedValue({});
    prisma.user.update.mockResolvedValue({});

    await service.processEvent('{}', 'sig');

    expect(prisma.payment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'FAILED' }),
      }),
    );
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { totalEarnings: { decrement: 5000 } },
      }),
    );
  });
});

describe('StripeService.constructEvent', () => {
  it('tries multiple webhook secrets', () => {
    const config = {
      get: jest.fn((key: string) => {
        if (key === 'stripe.secretKey') return 'sk_test_x';
        if (key === 'stripe.webhookSecret') return 'whsec_bad';
        if (key === 'stripe.connectWebhookSecret') return 'whsec_good';
        return '';
      }),
    };

    const service = new StripeService(config as never);
    const client = {
      webhooks: {
        constructEvent: jest
          .fn()
          .mockImplementation((_body, _sig, secret: string) => {
            if (secret === 'whsec_good') {
              return { id: 'evt', type: 'account.updated', data: { object: {} } };
            }
            throw new Error('bad sig');
          }),
      },
    };
    (service as unknown as { client: unknown }).client = client;

    const event = service.constructEvent('{}', 't=1,v1=x');
    expect(event.id).toBe('evt');
    expect(client.webhooks.constructEvent).toHaveBeenCalledTimes(2);
  });

  it('throws when no secrets configured', () => {
    const config = {
      get: jest.fn((key: string) =>
        key === 'stripe.secretKey' ? 'sk_test_x' : '',
      ),
    };
    const service = new StripeService(config as never);
    (service as unknown as { client: unknown }).client = {
      webhooks: { constructEvent: jest.fn() },
    };
    expect(() => service.constructEvent('{}', 'sig')).toThrow(
      BadRequestException,
    );
  });
});
