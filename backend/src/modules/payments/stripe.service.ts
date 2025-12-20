import { Injectable, Logger } from '@nestjs/common';
import { ConfigService  } from '@nestjs/config';
import Stripe from 'stripe';

@Injectable()
export class StripeService {
    private readonly logger = new Logger(StripeService.name);
    private readonly stripe: Stripe;

    constructor(private configService: ConfigService) {
        const apiKey = this.configService.get<string>('STRIPE_SECRET_KEY');

        if (!apiKey) {
            this.logger.warn('Stripe API key not configured');
        }

        this.stripe = new Stripe(apiKey || '', {
            apiVersion: '2025-12-15.clover'
        });
    }

    /**
     *  Get Stripe instance for direct API calls
     */
    getStripeInstance(): Stripe {
        return this.stripe;
    }

    /**
     * Create Stripe Connect Express account
     */
    async createConnectAccount(email: string, userId: string): Promise<Stripe.Account> {
        this.logger.log(`Creating Stripe Connect account for user: ${userId}`);

        try {
            const account = await this.stripe.accounts.create({
                type: 'express',
                country: 'US',
                email,
                capabilities: {
                    transfers: { requested: true },
                },
                metadata: {
                    userId, // Store our user ID in Stripe metadata
                },
            });

            this.logger.log(`Created Stripe account: ${account.id}`);
            return account;
        } catch (error) {
            this.logger.error(`Failed to create Stripe account: ${error.message}`);
            throw error;
        }
    }

    /**
    * Create account onboarding link
    */
   async createAccountLink(
    accountId: string,
    refreshUrl: string,
    returnUrl: string,
   ): Promise<Stripe.AccountLink> {
    this.logger.log(`Creating account link for: ${accountId}`);

    try {
        const accountLink = await this.stripe.accountLinks.create({
            account: accountId,
            refresh_url: refreshUrl,
            return_url: returnUrl,
            type: 'account_onboarding'
        });

        return accountLink;
    } catch (error) {
        this.logger.error(`Failed to create account link: ${error.message}`);
        throw error;
    }
   }

   /**
    * Retrieve account details
    */
   async getAccount(accountId: string): Promise<Stripe.Account> {
    try {
      return await this.stripe.accounts.retrieve(accountId);
    } catch (error) {
      this.logger.error(`Failed to retrieve account ${accountId}: ${error.message}`);
      throw error;
    }
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

    try {
      const transfer = await this.stripe.transfers.create({
        amount,
        currency: 'usd',
        destination: accountId,
        description,
      });

      this.logger.log(`Transfer created: ${transfer.id}`);
      return transfer;
    } catch (error) {
      this.logger.error(`Failed to create transfer: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Verify webhook signature
   */
  constructWebhookEvent(
    payload: string | Buffer,
    signature: string,
    secret: string,
  ): Stripe.Event {
    try {
        return this.stripe.webhooks.constructEvent(payload, signature, secret);
    } catch (error) {
        this.logger.error(`Webhook signature verification failed: ${error.message}`);
        throw error;
    }
  }
}