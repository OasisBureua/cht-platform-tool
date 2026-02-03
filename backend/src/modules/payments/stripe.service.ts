import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';

@Injectable()
export class StripeService {
  private readonly logger = new Logger(StripeService.name);
  private stripe: Stripe;

  constructor(private configService: ConfigService) {
    const secretKey = this.configService.get<string>('stripe.secretKey');
    
    if (!secretKey) {
      this.logger.warn('Stripe secret key not configured');
      return;
    }

    this.stripe = new Stripe(secretKey, {
      apiVersion: '2025-12-15.clover',
    });

    this.logger.log('Stripe initialized successfully');
  }

  /**
   * Create Stripe Connect Express account
   */
  async createConnectAccount(email: string, userId: string): Promise<Stripe.Account> {
    this.logger.log(`Creating Connect account for: ${email}`);

    const account = await this.stripe.accounts.create({
      type: 'express',
      email,
      capabilities: {
        transfers: { requested: true },
      },
      metadata: {
        userId,
      },
    });

    this.logger.log(`Created Connect account: ${account.id}`);
    return account;
  }

  /**
   * Create account link for onboarding
   */
  async createAccountLink(
    accountId: string,
    refreshUrl: string,
    returnUrl: string,
  ): Promise<Stripe.AccountLink> {
    const accountLink = await this.stripe.accountLinks.create({
      account: accountId,
      refresh_url: refreshUrl,
      return_url: returnUrl,
      type: 'account_onboarding',
    });

    return accountLink;
  }

  /**
   * Retrieve account details
   */
  async getAccount(accountId: string): Promise<Stripe.Account> {
    return await this.stripe.accounts.retrieve(accountId);
  }

  /**
   * Create transfer to connected account
   */
  async createTransfer(
    accountId: string,
    amount: number,
    description: string,
  ): Promise<Stripe.Transfer> {
    this.logger.log(`Creating transfer: $${amount / 100} to ${accountId}`);

    const transfer = await this.stripe.transfers.create({
      amount,
      currency: 'usd',
      destination: accountId,
      description,
    });

    this.logger.log(`Transfer created: ${transfer.id}`);
    return transfer;
  }

  /**
   * Construct webhook event
   */
  constructWebhookEvent(
    payload: string | Buffer,
    signature: string,
  ): Stripe.Event {
    const webhookSecret = this.configService.get<string>('stripe.webhookSecret');
    
    if (!webhookSecret) {
      throw new Error('Stripe webhook secret not configured');
    }

    return this.stripe.webhooks.constructEvent(payload, signature, webhookSecret);
  }
}
