import {
  Injectable,
  Logger,
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';

export type StripeAccountSummary = {
  id: string;
  payoutsEnabled: boolean;
  detailsSubmitted: boolean;
  chargesEnabled: boolean;
  currentlyDue: string[];
  /** Tax/identity requirements considered complete for our W-9 gate. */
  taxComplete: boolean;
  status: string;
  bankAccountLast4: string | null;
};

@Injectable()
export class StripeService {
  private readonly logger = new Logger(StripeService.name);
  private client: Stripe | null = null;

  constructor(private readonly configService: ConfigService) {}

  /** True when STRIPE_SECRET_KEY is set — payments happy path uses Stripe. */
  isConfigured(): boolean {
    return !!this.getSecretKey();
  }

  getPublishableKey(): string {
    return this.configService.get<string>('stripe.publishableKey') || '';
  }

  private getSecretKey(): string {
    return this.configService.get<string>('stripe.secretKey') || '';
  }

  private getWebhookSecrets(): string[] {
    const primary =
      this.configService.get<string>('stripe.webhookSecret') || '';
    const connect =
      this.configService.get<string>('stripe.connectWebhookSecret') || '';
    return [primary, connect].map((s) => s.trim()).filter(Boolean);
  }

  getClient(): Stripe {
    const key = this.getSecretKey();
    if (!key) {
      throw new ServiceUnavailableException(
        'Stripe is not configured (STRIPE_SECRET_KEY missing).',
      );
    }
    if (!this.client) {
      this.client = new Stripe(key, {
        apiVersion: '2026-08-26.dahlia',
        typescript: true,
      });
    }
    return this.client;
  }

  async createExpressAccount(input: {
    email: string;
    firstName?: string | null;
    lastName?: string | null;
    userId: string;
  }): Promise<Stripe.Account> {
    const stripe = this.getClient();
    return stripe.accounts.create({
      type: 'express',
      country: 'US',
      email: input.email,
      capabilities: {
        transfers: { requested: true },
      },
      business_type: 'individual',
      individual: {
        email: input.email,
        ...(input.firstName ? { first_name: input.firstName } : {}),
        ...(input.lastName ? { last_name: input.lastName } : {}),
      },
      metadata: { userId: input.userId },
    });
  }

  async createAccountLink(
    accountId: string,
    urls: { refreshUrl: string; returnUrl: string },
  ): Promise<Stripe.AccountLink> {
    const stripe = this.getClient();
    return stripe.accountLinks.create({
      account: accountId,
      refresh_url: urls.refreshUrl,
      return_url: urls.returnUrl,
      type: 'account_onboarding',
    });
  }

  /**
   * Account Session for Connect Embedded Components (account_onboarding).
   */
  async createAccountSession(accountId: string): Promise<{
    clientSecret: string;
    expiresAt: number;
  }> {
    const stripe = this.getClient();
    const session = await stripe.accountSessions.create({
      account: accountId,
      components: {
        account_onboarding: {
          enabled: true,
          features: {
            // Platform already authenticates the HCP in CHT.
            disable_stripe_user_authentication: true,
          },
        },
      },
    });
    return {
      clientSecret: session.client_secret,
      expiresAt: session.expires_at,
    };
  }

  async retrieveAccount(accountId: string): Promise<Stripe.Account> {
    return this.getClient().accounts.retrieve(accountId);
  }

  summarizeAccount(account: Stripe.Account): StripeAccountSummary {
    const currentlyDue = account.requirements?.currently_due ?? [];
    const pastDue = account.requirements?.past_due ?? [];
    const outstanding = [...new Set([...currentlyDue, ...pastDue])];

    const isTaxRequirement = (r: string) =>
      /tax|ssn|id_number|individual\.verification|company\.tax|ein/i.test(r);

    const taxOutstanding = outstanding.filter(isTaxRequirement);
    // PAY-4: no Stripe Tax Forms product — derive W-9/tax gate from Express requirements.
    // Tax is complete when details are submitted and nothing tax-related is currently/past due.
    const taxComplete =
      account.details_submitted === true &&
      taxOutstanding.length === 0 &&
      (outstanding.length === 0 || !!account.payouts_enabled);

    let status = 'onboarding_incomplete';
    if (account.payouts_enabled && account.details_submitted) {
      status = 'active';
    } else if (account.requirements?.disabled_reason) {
      status = 'restricted';
    } else if (account.details_submitted) {
      status = 'pending';
    }

    const ext = account.external_accounts?.data?.[0] as
      | Stripe.BankAccount
      | undefined;
    const bankAccountLast4 =
      ext && 'last4' in ext && typeof ext.last4 === 'string' ? ext.last4 : null;

    return {
      id: account.id,
      payoutsEnabled: !!account.payouts_enabled,
      detailsSubmitted: !!account.details_submitted,
      chargesEnabled: !!account.charges_enabled,
      currentlyDue: outstanding.length ? outstanding : currentlyDue,
      taxComplete,
      status,
      bankAccountLast4,
    };
  }

  async createTransfer(input: {
    amountCents: number;
    destinationAccountId: string;
    paymentId: string;
    userId: string;
    description?: string;
  }): Promise<Stripe.Transfer> {
    const stripe = this.getClient();
    if (input.amountCents < 1) {
      throw new BadRequestException('Transfer amount must be at least 1 cent');
    }
    return stripe.transfers.create(
      {
        amount: input.amountCents,
        currency: 'usd',
        destination: input.destinationAccountId,
        description: input.description,
        transfer_group: input.paymentId,
        metadata: {
          paymentId: input.paymentId,
          userId: input.userId,
        },
      },
      { idempotencyKey: `cht-payment-${input.paymentId}` },
    );
  }

  /**
   * Verify Stripe-Signature against platform and/or Connect webhook secrets.
   */
  constructEvent(rawBody: string | Buffer, signature: string): Stripe.Event {
    const stripe = this.getClient();
    const secrets = this.getWebhookSecrets();
    if (!secrets.length) {
      throw new BadRequestException(
        'Stripe webhook secrets not configured (STRIPE_WEBHOOK_SECRET / STRIPE_CONNECT_WEBHOOK_SECRET).',
      );
    }
    if (!signature) {
      throw new BadRequestException('Missing Stripe-Signature header');
    }
    const body =
      typeof rawBody === 'string' ? rawBody : rawBody.toString('utf8');
    let lastError: unknown;
    for (const secret of secrets) {
      try {
        return stripe.webhooks.constructEvent(body, signature, secret);
      } catch (err) {
        lastError = err;
      }
    }
    this.logger.warn(
      `[Stripe webhook] signature verification failed for ${secrets.length} secret(s)`,
    );
    throw new BadRequestException(
      lastError instanceof Error
        ? `Webhook signature verification failed: ${lastError.message}`
        : 'Webhook signature verification failed',
    );
  }
}
