import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const BILL_STAGE_URL = 'https://gateway.stage.bill.com/connect/v3';
const BILL_PROD_URL = 'https://gateway.prod.bill.com/connect/v3';

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
  address: {
    line1: string;
    city: string;
    stateOrProvince?: string;
    zipOrPostalCode: string;
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

export interface BillElementSession {
  sessionId: string;
  userId: string;
  orgId: string;
  devKey: string;
}

@Injectable()
export class BillService {
  private readonly logger = new Logger(BillService.name);
  private devKey: string;
  private sessionId: string | null = null;
  private userId: string | null = null;
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
    if (!this.username || !this.password || !this.orgId) {
      this.logger.warn(
        `Bill.com login credentials incomplete. Have: devKey=${!!this.devKey} username=${!!this.username} password=${!!this.password} orgId=${!!this.orgId}`,
      );
    }
  }

  /**
   * Get credentials for Bill.com Elements SDK (vendorSetupApp).
   * Frontend uses these to initialize the embedded Element.
   */
  async getElementSession(): Promise<BillElementSession> {
    const sessionId = await this.ensureSession();
    if (!this.userId) {
      throw new Error('Bill.com userId not available after login');
    }
    return {
      sessionId,
      userId: this.userId,
      orgId: this.orgId || '',
      devKey: this.devKey,
    };
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
    if (this.sessionId) return this.sessionId;
    const missing: string[] = [];
    if (!this.username?.trim()) missing.push('BILL_USERNAME');
    if (!this.password) missing.push('BILL_PASSWORD');
    if (!this.orgId?.trim()) missing.push('BILL_ORG_ID');
    if (!this.devKey?.trim()) missing.push('BILL_DEV_KEY');
    if (missing.length > 0) {
      throw new Error(
        `Bill.com credentials not configured. Missing in backend/.env: ${missing.join(', ')}. (Or set BILL_SESSION_ID for manual session.)`,
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
    this.userId = data.userId;
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
   * Create a US vendor (HCP) in Bill.com.
   * Country is always US. Address is required. Bank account optional at creation
   * but required before ACH payout.
   */
  async createVendor(input: CreateVendorInput): Promise<BillVendor> {
    this.logger.log(`Creating Bill.com vendor: ${input.email}`);

    const payload: Record<string, unknown> = {
      name: input.name,
      email: input.email,
      accountType: 'PERSON',
      address: {
        line1: input.address.line1,
        city: input.address.city,
        stateOrProvince: input.address.stateOrProvince ?? '',
        zipOrPostalCode: input.address.zipOrPostalCode,
        country: 'US',
      },
      billCurrency: 'USD',
    };

    if (input.paymentInformation) {
      payload.paymentInformation = {
        payeeName: input.paymentInformation.payeeName,
        bankAccount: {
          nameOnAccount: input.paymentInformation.bankAccount.nameOnAccount,
          accountNumber: input.paymentInformation.bankAccount.accountNumber,
          routingNumber: input.paymentInformation.bankAccount.routingNumber,
        },
      };
    }

    const vendor = await this.request<BillVendor>('POST', '/vendors', payload);
    this.logger.log(`Created Bill.com vendor: ${vendor.id}`);
    return vendor;
  }

  /**
   * Update vendor address and ACH details (Connect v3 PATCH). Requires at least one recognized top-level field.
   */
  async updateVendorPaymentAndAddress(vendorId: string, input: CreateVendorInput): Promise<BillVendor> {
    this.logger.log(`Updating Bill.com vendor payment/address: ${vendorId}`);
    const payload: Record<string, unknown> = {
      name: input.name,
      email: input.email,
      accountType: 'PERSON',
      address: {
        line1: input.address.line1,
        city: input.address.city,
        stateOrProvince: input.address.stateOrProvince ?? '',
        zipOrPostalCode: input.address.zipOrPostalCode,
        country: 'US',
      },
      billCurrency: 'USD',
    };
    if (input.paymentInformation) {
      payload.paymentInformation = {
        payeeName: input.paymentInformation.payeeName,
        bankAccount: {
          nameOnAccount: input.paymentInformation.bankAccount.nameOnAccount,
          accountNumber: input.paymentInformation.bankAccount.accountNumber,
          routingNumber: input.paymentInformation.bankAccount.routingNumber,
        },
      };
    }
    return this.request<BillVendor>('PATCH', `/vendors/${vendorId}`, payload);
  }

  /**
   * Get vendor by ID
   */
  async getVendor(vendorId: string): Promise<BillVendor> {
    return this.request<BillVendor>('GET', `/vendors/${vendorId}`);
  }

  /** Raw vendor payload for masked display (bank fields may be partially redacted by Bill.com). */
  async getVendorJson(vendorId: string): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>('GET', `/vendors/${vendorId}`);
  }

  /**
   * Update vendor with W-9 / tax information (Connect v3: tax fields live under `additionalInfo`).
   */
  async updateVendorTaxInfo(
    vendorId: string,
    data: { taxId: string; taxIdType: 'SSN' | 'EIN'; companyName?: string; track1099?: boolean },
  ): Promise<BillVendor> {
    this.logger.log(`Updating Bill.com vendor tax info: ${vendorId}`);
    const additionalInfo: Record<string, unknown> = {
      taxId: data.taxId.replace(/\D/g, ''),
      taxIdType: data.taxIdType,
      track1099: data.track1099 ?? true,
    };
    if (data.companyName?.trim()) additionalInfo.companyName = data.companyName.trim();
    return this.request<BillVendor>('PATCH', `/vendors/${vendorId}`, { additionalInfo });
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
