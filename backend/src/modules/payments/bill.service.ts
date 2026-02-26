import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const BILL_STAGE_URL = 'https://gateway.stage.bill.com/connect/v3';
const BILL_PROD_URL = 'https://gateway.bill.com/connect/v3';

export interface BillVendor {
  id: string;
  name: string;
  email: string;
  accountType: string;
}

export interface BillPayment {
  id: string;
  vendorId: string;
  amount: number;
  status: string;
}

export interface CreateVendorInput {
  name: string;
  email: string;
  accountType: 'PERSON' | 'BUSINESS' | 'NONE';
  phone?: string;
  address?: {
    line1: string;
    city: string;
    stateOrProvince?: string;
    zipOrPostalCode: string;
    country: string;
  };
  paymentInformation?: {
    payeeName: string;
    bankAccount: {
      nameOnAccount: string;
      accountNumber: string;
      routingNumber: string;
    };
  };
}

interface BillLoginResponse {
  sessionId: string;
  organizationId: string;
  userId: string;
}

@Injectable()
export class BillService {
  private readonly logger = new Logger(BillService.name);
  private devKey: string;
  private sessionId: string | null = null;
  private baseUrl: string;
  private username: string | null = null;
  private password: string | null = null;
  private orgId: string | null = null;

  constructor(private configService: ConfigService) {
    this.devKey = this.configService.get<string>('bill.devKey') || '';
    this.sessionId = this.configService.get<string>('bill.sessionId') || null;
    this.username = this.configService.get<string>('bill.username') || null;
    this.password = this.configService.get<string>('bill.password') || null;
    this.orgId = this.configService.get<string>('bill.orgId') || null;

    const env = this.configService.get<string>('NODE_ENV') || 'development';
    this.baseUrl = env === 'production'
      ? this.configService.get<string>('bill.apiUrl') || BILL_PROD_URL
      : this.configService.get<string>('bill.apiUrl') || BILL_STAGE_URL;

    if (!this.devKey) {
      this.logger.warn('Bill.com dev key not configured');
    }
  }

  /**
   * Test Bill.com connection (login only). Does not require funding account ID.
   * Use to verify org ID, username, password, dev key before enabling payouts.
   */
  async testConnection(): Promise<{ success: true; organizationId: string }> {
    const sessionId = await this.login();
    const orgId = this.orgId || '';
    this.logger.log(`Bill.com connection test OK: orgId=${orgId}`);
    return { success: true, organizationId: orgId };
  }

  /**
   * Login to Bill.com API to obtain session.
   * POST /v3/login with username, password, organizationId, devKey
   * Session expires after 35 minutes of inactivity.
   */
  private async login(): Promise<string> {
    if (!this.username || !this.password || !this.orgId) {
      throw new Error(
        'Bill.com credentials not configured. Set BILL_USERNAME, BILL_PASSWORD, BILL_ORG_ID (or BILL_SESSION_ID for manual session).',
      );
    }

    const url = `${this.baseUrl}/login`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: this.username,
        password: this.password,
        organizationId: this.orgId,
        devKey: this.devKey,
      }),
    });

    const text = await res.text();
    if (!res.ok) {
      throw new Error(`Bill.com login failed (${res.status}): ${text}`);
    }

    const data = JSON.parse(text) as BillLoginResponse;
    this.sessionId = data.sessionId;
    this.logger.log('Bill.com session established');
    return this.sessionId;
  }

  private async ensureSession(): Promise<string> {
    if (this.sessionId) return this.sessionId;
    if (this.username && this.password && this.orgId) {
      return this.login();
    }
    throw new Error(
      'Bill.com sessionId not configured. Set BILL_SESSION_ID or BILL_USERNAME+BILL_PASSWORD+BILL_ORG_ID.',
    );
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
    retryOn401 = true,
  ): Promise<T> {
    const sessionId = await this.ensureSession();
    const url = `${this.baseUrl}${path}`;

    const res = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        devKey: this.devKey,
        sessionId,
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    const text = await res.text();

    // Session expired - retry with fresh login
    if (res.status === 401 && retryOn401 && this.username && this.password && this.orgId) {
      this.logger.warn('Bill.com session expired, re-logging in');
      this.sessionId = null;
      return this.request<T>(method, path, body, false);
    }

    if (!res.ok) {
      throw new Error(`Bill.com API error (${res.status}): ${text}`);
    }

    return text ? (JSON.parse(text) as T) : ({} as T);
  }

  /**
   * Create vendor (HCP) in Bill.com
   */
  async createVendor(input: CreateVendorInput): Promise<BillVendor> {
    this.logger.log(`Creating Bill.com vendor: ${input.email}`);

    const payload: Record<string, unknown> = {
      name: input.name,
      email: input.email,
      accountType: input.accountType,
      phone: input.phone || '0000000000',
      address: input.address || {
        line1: 'TBD',
        city: 'TBD',
        stateOrProvince: 'CA',
        zipOrPostalCode: '00000',
        country: 'US',
      },
      billCurrency: 'USD',
    };

    if (input.paymentInformation) {
      payload.paymentInformation = {
        payeeName: input.paymentInformation.payeeName,
        bankAccount: input.paymentInformation.bankAccount,
      };
    }

    const vendor = await this.request<BillVendor>('POST', '/vendors', payload);
    this.logger.log(`Created Bill.com vendor: ${vendor.id}`);
    return vendor;
  }

  /**
   * Get vendor by ID
   */
  async getVendor(vendorId: string): Promise<BillVendor> {
    return this.request<BillVendor>('GET', `/vendors/${vendorId}`);
  }

  /**
   * Create payment to vendor (auto-creates bill when createBill: true)
   */
  async createPayment(
    vendorId: string,
    amountCents: number,
    description: string,
  ): Promise<BillPayment> {
    const amountDollars = amountCents / 100;
    this.logger.log(`Creating Bill.com payment: $${amountDollars} to ${vendorId}`);

    const fundingAccountId = this.configService.get<string>('bill.fundingAccountId');
    if (!fundingAccountId) {
      throw new Error('Bill.com funding account ID not configured');
    }

    const processDate = new Date();
    processDate.setDate(processDate.getDate() + 1);
    const processDateStr = processDate.toISOString().split('T')[0];

    const payload = {
      vendorId,
      amount: amountDollars,
      description: description || 'Honorarium payment',
      processDate: processDateStr,
      fundingAccount: {
        type: 'BANK_ACCOUNT',
        id: fundingAccountId,
      },
      processingOptions: {
        createBill: true,
        requestPayFaster: false,
      },
    };

    const payment = await this.request<BillPayment>('POST', '/payments', payload);
    this.logger.log(`Bill.com payment created: ${payment.id}`);
    return payment;
  }
}
