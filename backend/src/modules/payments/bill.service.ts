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
  /** True when session is MFA-trusted (required for POST /v3/payments). */
  trusted?: boolean;
}

/** GET /v3/login/session — https://developer.bill.com/reference/getsessioninfo */
interface BillSessionInfoResponse {
  organizationId?: string;
  userId?: string;
  /**
   * Organization MFA state for this session (Bill enum).
   * COMPLETE = API session is MFA-trusted (payments allowed). DISABLED = MFA off for org.
   * SETUP / CHALLENGE = not trusted for payments until MFA path completes.
   */
  mfaStatus?: 'DISABLED' | 'SETUP' | 'CHALLENGE' | 'COMPLETE' | 'UNDEFINED';
  /** When true, MFA is disabled at developer-key level; orgs on this key skip MFA. */
  mfaBypass?: boolean;
}

export interface BillElementSession {
  sessionId: string;
  userId: string;
  orgId: string;
  devKey: string;
}

/** Organization bank funding account (BILL list API: GET .../funding-accounts/banks). IDs typically begin with `bac`. */
export interface BillBankFundingAccount {
  id: string;
  archived: boolean;
  status?: string;
  bankName?: string;
  nameOnAccount?: string;
  default?: { payables?: boolean; receivables?: boolean };
}

export interface ListBankFundingAccountsResponse {
  results?: BillBankFundingAccount[];
  nextPage?: string;
  prevPage?: string;
}

/** Same as Bill list API, plus recommended BILL_FUNDING_ACCOUNT_ID (default payables). */
export interface BillFundingAccountsWithRecommendation extends ListBankFundingAccountsResponse {
  recommendedFundingAccountId: string | null;
  recommendationNote: string;
  configuredFundingAccountId?: string | null;
  configuredMatchesRecommended?: boolean;
}

/**
 * Bill.com Connect v3 client.
 *
 * - Most paths use `ensureSession()` (env `BILL_SESSION_ID` or `POST /v3/login`).
 * - **Payments** use `ensurePaymentSessionCached()`: in-memory `sessionId` from the last successful
 *   `POST /v3/login`, refreshed when older than `bill.paySessionCacheTtlMs` (default 30 minutes).
 * - Bill still enforces MFA trust for `POST /v3/payments` unless you set `BILL_ALLOW_UNTRUSTED_PAYMENTS`
 *   (local guard only; Bill may still reject with BDC_1361).
 */
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
  /** Known only after POST /v3/login or GET /v3/login/session. */
  private sessionTrusted: boolean | null = null;
  /** True when BILL_SESSION_ID was set at startup (vs password login only). */
  private readonly initialSessionFromEnv: boolean;
  /** Set when `login()` succeeds; used to TTL-cache payment sessions without re-calling POST /login. */
  private passwordSessionIssuedAtMs: number | null = null;

  constructor(private configService: ConfigService) {
    this.devKey = this.configService.get<string>('bill.devKey') || '';
    this.username = this.configService.get<string>('bill.username') || null;
    this.password = this.configService.get<string>('bill.password') || null;
    this.orgId = this.configService.get<string>('bill.orgId') || null;

    const envSession =
      (this.configService.get<string>('bill.sessionId') || '').trim() || null;
    const hasPasswordLogin = !!(
      this.username?.trim() &&
      this.password &&
      this.orgId?.trim()
    );

    // Prefer BILL_SESSION_ID when set (automation / Lambda-rotated secrets, MFA-trusted session from Bill).
    // Password login remains available as fallback after 401/403 clears the in-memory session.
    if (envSession) {
      this.sessionId = envSession;
      this.initialSessionFromEnv = true;
      if (hasPasswordLogin) {
        this.logger.log(
          'Bill.com: using BILL_SESSION_ID; username/password will be used only if the session is rejected (401/403).',
        );
      }
    } else if (hasPasswordLogin) {
      this.sessionId = null;
      this.initialSessionFromEnv = false;
    } else {
      this.sessionId = null;
      this.initialSessionFromEnv = false;
    }

    const env = this.configService.get<string>('NODE_ENV') || 'development';
    this.baseUrl =
      env === 'production'
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

  private clearInMemoryBillSession(): void {
    this.sessionId = null;
    this.userId = null;
    this.sessionTrusted = null;
    this.passwordSessionIssuedAtMs = null;
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
   * Test Bill.com session (env session and/or login). Does not require funding account ID.
   */
  async testConnection(): Promise<{
    success: true;
    organizationId: string;
    /** True / false from Bill after login or GET /login/session; use unknown until hydrated. */
    mfaTrusted: boolean | null;
    sessionFromEnv: boolean;
  }> {
    await this.ensureSession();
    const orgId = this.orgId || '';
    const mfaTrusted = this.sessionTrusted;
    this.logger.log(
      `Bill.com connection test OK: orgId=${orgId} mfaTrusted=${String(mfaTrusted)} sessionFromEnv=${this.initialSessionFromEnv}`,
    );
    return {
      success: true,
      organizationId: orgId,
      mfaTrusted,
      sessionFromEnv: this.initialSessionFromEnv,
    };
  }

  /**
   * List organization bank funding accounts (Connect v3: GET /funding-accounts/banks).
   * Use the `id` from the account you use for AP payables as BILL_FUNDING_ACCOUNT_ID (often starts with `bac`).
   */
  async listBankFundingAccounts(
    max = 100,
  ): Promise<ListBankFundingAccountsResponse> {
    const cap = Math.min(100, Math.max(1, max));
    return this.request<ListBankFundingAccountsResponse>(
      'GET',
      `/funding-accounts/banks?max=${cap}`,
    );
  }

  /**
   * Lists funding banks and the id Bill marks as default for payables (usual BILL_FUNDING_ACCOUNT_ID).
   */
  async listBankFundingAccountsWithRecommendation(
    max = 100,
  ): Promise<BillFundingAccountsWithRecommendation> {
    const data = await this.listBankFundingAccounts(max);
    const results = data.results ?? [];
    const defaultPayables = results.find(
      (a) => !a.archived && a.default?.payables === true,
    );
    const recommendedFundingAccountId = defaultPayables?.id ?? null;
    const recommendationNote = recommendedFundingAccountId
      ? 'Use this id as BILL_FUNDING_ACCOUNT_ID: organization default for payables (AP debits).'
      : 'No non-archived account has default.payables=true. Pick an id from results or set a default in Bill.com.';

    const configured =
      (this.configService.get<string>('bill.fundingAccountId') || '').trim() ||
      null;

    const out: BillFundingAccountsWithRecommendation = {
      ...data,
      recommendedFundingAccountId,
      recommendationNote,
    };

    if (configured) {
      out.configuredFundingAccountId = configured;
      if (recommendedFundingAccountId) {
        out.configuredMatchesRecommended =
          configured === recommendedFundingAccountId;
      }
    }

    return out;
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
    const body: Record<string, string> = {
      username: this.username!,
      password: this.password!,
      organizationId: this.orgId!,
      devKey: this.devKey,
    };
    const rememberMeId = (
      this.configService.get<string>('bill.mfaRememberMeId') || ''
    ).trim();
    const device = (
      this.configService.get<string>('bill.mfaDeviceName') || ''
    ).trim();
    if (rememberMeId && device) {
      body.rememberMeId = rememberMeId;
      body.device = device;
    } else if (rememberMeId || device) {
      this.logger.warn(
        'Bill.com: set both BILL_MFA_REMEMBER_ME_ID and BILL_MFA_DEVICE_NAME for MFA-trusted login; ignoring partial MFA config.',
      );
    }

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const text = await res.text();
    if (!res.ok) {
      throw new Error(`Bill.com login failed (${res.status}): ${text}`);
    }

    const data = JSON.parse(text) as BillLoginResponse;
    this.sessionId = data.sessionId;
    this.userId = data.userId;
    this.sessionTrusted = data.trusted === true;
    if (!this.sessionTrusted) {
      this.logger.warn(
        'Bill.com: login OK but session is not MFA-trusted (trusted=false). Pay now needs BILL_MFA_REMEMBER_ME_ID + BILL_MFA_DEVICE_NAME from MFA validate (rememberMe: true).',
      );
    } else {
      this.logger.log('Bill.com session established (MFA-trusted)');
    }
    this.passwordSessionIssuedAtMs = Date.now();
    return this.sessionId;
  }

  /**
   * Fills userId / orgId / sessionTrusted for BILL_SESSION_ID-only setups (GET /v3/login/session).
   * Avoids recursion into request(); uses raw fetch.
   */
  private async hydrateSessionInfo(): Promise<void> {
    const sessionId = this.sessionId;
    if (!sessionId || !this.devKey?.trim()) return;

    const url = `${this.baseUrl}/login/session`;
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        devKey: this.devKey,
        sessionId,
      },
    });
    const text = await res.text();
    if (!res.ok) {
      throw new Error(
        `Bill.com GET /login/session failed (${res.status}): ${text}`,
      );
    }
    const data = text ? (JSON.parse(text) as BillSessionInfoResponse) : {};
    if (data.userId) this.userId = data.userId;
    if (data.organizationId) this.orgId = data.organizationId;

    // https://developer.bill.com/reference/getsessioninfo
    if (
      data.mfaBypass === true ||
      data.mfaStatus === 'COMPLETE' ||
      data.mfaStatus === 'DISABLED'
    ) {
      this.sessionTrusted = true;
    } else if (data.mfaStatus && data.mfaStatus !== 'UNDEFINED') {
      this.sessionTrusted = false;
    }

    this.logger.log(
      `Bill.com GET /login/session: mfaStatus=${data.mfaStatus ?? 'n/a'} mfaBypass=${data.mfaBypass === true} ` +
        `sessionTrusted=${this.sessionTrusted}`,
    );
  }

  private async ensureSession(): Promise<string> {
    if (this.sessionId) {
      if (!this.userId) {
        await this.hydrateSessionInfo();
      }
      return this.sessionId;
    }
    if (this.username && this.password && this.orgId) {
      return this.login();
    }
    throw new Error(
      'Bill.com sessionId not configured. Set BILL_SESSION_ID or BILL_USERNAME+BILL_PASSWORD+BILL_ORG_ID.',
    );
  }

  /**
   * Pay flow: keep the last successful `POST /v3/login` session in memory and only call Bill login
   * again after `bill.paySessionCacheTtlMs` (default 30 minutes). Still requires Bill pay creds in env.
   */
  async ensurePaymentSessionCached(): Promise<void> {
    const canLogin = !!(
      this.devKey?.trim() &&
      this.username?.trim() &&
      this.password &&
      this.orgId?.trim()
    );
    if (!canLogin) {
      throw new Error(
        'Bill.com payments require BILL_DEV_KEY, BILL_USERNAME, BILL_PASSWORD, and BILL_ORG_ID so the server can POST /v3/login.',
      );
    }
    const ttlMs =
      this.configService.get<number>('bill.paySessionCacheTtlMs') ??
      30 * 60 * 1000;
    const cacheFresh =
      !!this.sessionId &&
      this.passwordSessionIssuedAtMs !== null &&
      Date.now() - this.passwordSessionIssuedAtMs < ttlMs;
    if (cacheFresh) {
      this.logger.debug(`Bill.com payment session cache hit (TTL ${ttlMs}ms)`);
      return;
    }
    this.logger.log(
      'Bill.com: POST /v3/login for payment session (cache miss or TTL expired)',
    );
    this.clearInMemoryBillSession();
    await this.login();
  }

  /**
   * MFA-trusted session required for POST /v3/payments unless `BILL_ALLOW_UNTRUSTED_PAYMENTS` is set.
   */
  private assertMfaTrustedForPayments(): void {
    const allowUntrusted = this.configService.get<boolean>(
      'bill.allowUntrustedPayments',
    );
    if (allowUntrusted) {
      if (this.sessionTrusted === false) {
        this.logger.warn(
          'BILL_ALLOW_UNTRUSTED_PAYMENTS: proceeding to POST /v3/payments; Bill may still reject with BDC_1361.',
        );
      }
      return;
    }
    if (this.sessionTrusted === false) {
      throw new Error(
        'Bill.com session is not MFA-trusted (BDC_1361). For Pay now, use a trusted sessionId: set BILL_SESSION_ID ' +
          'to a session from MFA-complete login (Bill UI or API), refresh it periodically (~35 min inactivity), ' +
          'or automate rotation via Lambda updating Secrets Manager. Optional: BILL_MFA_REMEMBER_ME_ID + BILL_MFA_DEVICE_NAME. ' +
          'If you cannot obtain MFA trust (e.g. sandbox only), set BILL_ALLOW_UNTRUSTED_PAYMENTS=true to skip this check locally ' +
          '(Bill may still block the request). See https://developer.bill.com/reference/getsessioninfo.',
      );
    }
  }

  private billSessionRetryable(status: number, bodyText: string): boolean {
    if (status === 401) return true;
    if (status !== 403) return false;
    const t = bodyText.toLowerCase();
    return t.includes('untrusted session') || t.includes('bdc_1361');
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
    retryOnSessionFailure = true,
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

    const canPasswordLogin = !!(this.username && this.password && this.orgId);
    if (
      retryOnSessionFailure &&
      canPasswordLogin &&
      this.billSessionRetryable(res.status, text)
    ) {
      this.logger.warn(
        `Bill.com session rejected (${res.status}), re-logging in`,
      );
      this.clearInMemoryBillSession();
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
  async updateVendorPaymentAndAddress(
    vendorId: string,
    input: CreateVendorInput,
  ): Promise<BillVendor> {
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
    data: {
      taxId: string;
      taxIdType: 'SSN' | 'EIN';
      companyName?: string;
      track1099?: boolean;
    },
  ): Promise<BillVendor> {
    this.logger.log(`Updating Bill.com vendor tax info: ${vendorId}`);
    const additionalInfo: Record<string, unknown> = {
      taxId: data.taxId.replace(/\D/g, ''),
      taxIdType: data.taxIdType,
      track1099: data.track1099 ?? true,
    };
    if (data.companyName?.trim())
      additionalInfo.companyName = data.companyName.trim();
    return this.request<BillVendor>('PATCH', `/vendors/${vendorId}`, {
      additionalInfo,
    });
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
    this.logger.log(
      `Creating Bill.com payment: $${amountDollars} to ${vendorId}`,
    );

    await this.ensurePaymentSessionCached();
    this.assertMfaTrustedForPayments();

    const fundingAccountId = this.configService.get<string>(
      'bill.fundingAccountId',
    );
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

    const payment = await this.request<BillPayment>(
      'POST',
      '/payments',
      payload,
    );
    this.logger.log(`Bill.com payment created: ${payment.id}`);
    return payment;
  }
}
