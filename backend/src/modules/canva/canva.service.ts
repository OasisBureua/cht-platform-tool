import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Send to Canva (admin Post-production). Each admin connects their own Canva
 * account once through Canva Connect (OAuth with PKCE); after that a studio
 * can import a deck or carousel straight into that account as an editable
 * design. Tokens never leave the server and are stored sealed.
 */
export const CANVA_AUTHORIZE_URL = 'https://www.canva.com/api/oauth/authorize';
export const CANVA_API = 'https://api.canva.com/rest/v1';
export const CANVA_SCOPES = 'design:content:write';
export const PPTX_MIME =
  'application/vnd.openxmlformats-officedocument.presentationml.presentation';
const PENDING_TTL_MS = 10 * 60_000;
/** Refresh a little early so a token never lapses mid-import. */
const REFRESH_MARGIN_MS = 60_000;

export type CanvaStatus = { configured: boolean; connected: boolean };
export type CanvaImportJob = {
  status: 'in_progress' | 'success' | 'failed';
  editUrl?: string;
  viewUrl?: string;
  error?: string;
};
type TokenResponse = {
  access_token: string;
  refresh_token: string;
  expires_in?: number;
  scope?: string;
};

class CanvaHttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

const b64url = (b: Buffer) => b.toString('base64url');
const notConnected = (message: string) =>
  new ConflictException({ code: 'CANVA_NOT_CONNECTED', message });

@Injectable()
export class CanvaService {
  private readonly logger = new Logger(CanvaService.name);
  /** One token lookup at a time per admin: Canva refresh tokens are single use. */
  private readonly refreshing = new Map<string, Promise<string>>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  private get clientId(): string {
    return this.config.get<string>('canva.clientId') ?? '';
  }

  private get clientSecret(): string {
    return this.config.get<string>('canva.clientSecret') ?? '';
  }

  get redirectUri(): string {
    const set = this.config.get<string>('canva.redirectUri');
    if (set) return set;
    const front = (this.config.get<string>('frontendUrl') ?? '').replace(
      /\/$/,
      '',
    );
    return `${front}/api/canva/callback`;
  }

  isConfigured(): boolean {
    return !!(this.clientId && this.clientSecret);
  }

  private requireConfigured(): void {
    if (!this.isConfigured()) {
      throw new ServiceUnavailableException(
        "Canva isn't set up on the platform yet. Add the Canva app keys first.",
      );
    }
  }

  /* ── sealing: AES-256-GCM keyed from the client secret ─────────────── */
  private key(): Buffer {
    return createHash('sha256')
      .update(`canva-token:${this.clientSecret}`)
      .digest();
  }

  seal(plain: string): string {
    const iv = randomBytes(12);
    const c = createCipheriv('aes-256-gcm', this.key(), iv);
    const body = Buffer.concat([c.update(plain, 'utf8'), c.final()]);
    return ['v1', b64url(iv), b64url(c.getAuthTag()), b64url(body)].join('.');
  }

  open(sealed: string): string {
    const [v, iv, tag, body] = sealed.split('.');
    if (v !== 'v1' || !iv || !tag || body === undefined) {
      throw new Error('Unreadable sealed value');
    }
    const d = createDecipheriv(
      'aes-256-gcm',
      this.key(),
      Buffer.from(iv, 'base64url'),
    );
    d.setAuthTag(Buffer.from(tag, 'base64url'));
    return Buffer.concat([
      d.update(Buffer.from(body, 'base64url')),
      d.final(),
    ]).toString('utf8');
  }

  /* ── connection ─────────────────────────────────────────────────────── */
  async status(userId: string): Promise<CanvaStatus> {
    if (!this.isConfigured()) return { configured: false, connected: false };
    const c = await this.prisma.canvaConnection.findUnique({
      where: { userId },
      select: { refreshToken: true },
    });
    return { configured: true, connected: !!c?.refreshToken };
  }

  /** Starts a sign-in: stores a one-time state and PKCE verifier, returns Canva's consent URL. */
  async authorizeUrl(userId: string): Promise<string> {
    this.requireConfigured();
    const verifier = b64url(randomBytes(48));
    const challenge = b64url(createHash('sha256').update(verifier).digest());
    const state = b64url(randomBytes(24));
    const pending = {
      pendingState: state,
      pendingVerifier: this.seal(verifier),
      pendingExpiresAt: new Date(Date.now() + PENDING_TTL_MS),
    };
    await this.prisma.canvaConnection.upsert({
      where: { userId },
      create: { userId, ...pending },
      update: pending,
    });
    const q = new URLSearchParams({
      code_challenge: challenge,
      code_challenge_method: 'S256',
      scope: CANVA_SCOPES,
      response_type: 'code',
      client_id: this.clientId,
      state,
      redirect_uri: this.redirectUri,
    });
    return `${CANVA_AUTHORIZE_URL}?${q.toString()}`;
  }

  /** Canva's redirect lands here: swap the code for tokens and keep them. */
  async completeAuthorization(code?: string, state?: string): Promise<void> {
    this.requireConfigured();
    if (!code || !state) {
      throw new BadRequestException('Canva sent the sign-in back incomplete.');
    }
    const c = await this.prisma.canvaConnection.findUnique({
      where: { pendingState: state },
    });
    if (
      !c?.pendingVerifier ||
      !c.pendingExpiresAt ||
      c.pendingExpiresAt.getTime() < Date.now()
    ) {
      throw new BadRequestException(
        'This Canva sign-in has expired. Press Send to Canva again.',
      );
    }
    let tokens: TokenResponse;
    try {
      tokens = await this.token({
        grant_type: 'authorization_code',
        code,
        code_verifier: this.open(c.pendingVerifier),
        redirect_uri: this.redirectUri,
      });
    } catch (e) {
      this.logger.warn(
        `Canva code exchange failed: ${e instanceof Error ? e.message : String(e)}`,
      );
      throw new BadGatewayException(
        "Canva didn't accept the sign-in. Press Send to Canva again.",
      );
    }
    await this.prisma.canvaConnection.update({
      where: { id: c.id },
      data: {
        ...this.tokenData(tokens),
        pendingState: null,
        pendingVerifier: null,
        pendingExpiresAt: null,
      },
    });
  }

  private tokenData(t: TokenResponse) {
    return {
      accessToken: this.seal(t.access_token),
      refreshToken: this.seal(t.refresh_token),
      expiresAt: new Date(Date.now() + (t.expires_in ?? 3600) * 1000),
      scope: t.scope ?? null,
    };
  }

  private async token(body: Record<string, string>): Promise<TokenResponse> {
    const basic = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString(
      'base64',
    );
    const res = await fetch(`${CANVA_API}/oauth/token`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${basic}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams(body).toString(),
    });
    const json = (await res.json().catch(() => ({}))) as Partial<
      TokenResponse & { error: string; error_description: string }
    >;
    if (!res.ok || !json.access_token || !json.refresh_token) {
      throw new CanvaHttpError(
        res.status,
        json.error_description || json.error || `HTTP ${res.status}`,
      );
    }
    return json as TokenResponse;
  }

  /** A live access token for this admin, refreshed (and the refresh token rotated) when near expiry. */
  async accessToken(userId: string): Promise<string> {
    const inFlight = this.refreshing.get(userId);
    if (inFlight) return inFlight;
    /* registered before the first await, so a second request joins this one */
    const run = this.resolveToken(userId);
    this.refreshing.set(userId, run);
    try {
      return await run;
    } finally {
      if (this.refreshing.get(userId) === run) this.refreshing.delete(userId);
    }
  }

  private async resolveToken(userId: string): Promise<string> {
    const c = await this.prisma.canvaConnection.findUnique({
      where: { userId },
    });
    if (!c?.refreshToken) throw notConnected('Connect Canva first.');
    const sealedRefresh = c.refreshToken;
    if (
      c.accessToken &&
      c.expiresAt &&
      c.expiresAt.getTime() - Date.now() > REFRESH_MARGIN_MS
    ) {
      try {
        return this.open(c.accessToken);
      } catch {
        /* sealed with an older secret: fall through and refresh */
      }
    }
    let refresh: string;
    try {
      refresh = this.open(sealedRefresh);
    } catch {
      await this.forget(c.id);
      throw notConnected(
        'Your Canva connection needs renewing. Connect again.',
      );
    }
    try {
      const t = await this.token({
        grant_type: 'refresh_token',
        refresh_token: refresh,
      });
      await this.prisma.canvaConnection.update({
        where: { id: c.id },
        data: this.tokenData(t),
      });
      return t.access_token;
    } catch (e) {
      if (
        e instanceof CanvaHttpError &&
        (e.status === 400 || e.status === 401)
      ) {
        await this.forget(c.id);
        throw notConnected('Your Canva connection expired. Connect again.');
      }
      throw new BadGatewayException(
        "Couldn't reach Canva. Try again in a moment.",
      );
    }
  }

  private async forget(id: string): Promise<void> {
    await this.prisma.canvaConnection.update({
      where: { id },
      data: { accessToken: null, refreshToken: null, expiresAt: null },
    });
  }

  /* ── imports ────────────────────────────────────────────────────────── */
  /** Hands the file to Canva's design import; returns the import job id. */
  async startImport(
    userId: string,
    file: Buffer,
    title: string,
    mime: string = PPTX_MIME,
  ): Promise<string> {
    this.requireConfigured();
    const token = await this.accessToken(userId);
    const name = [...(title.trim() || 'CHM design')].slice(0, 50).join('');
    const res = await fetch(`${CANVA_API}/imports`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/octet-stream',
        'Import-Metadata': JSON.stringify({
          title_base64: Buffer.from(name, 'utf8').toString('base64'),
          mime_type: mime,
        }),
      },
      body: new Blob([new Uint8Array(file)]),
    });
    const json = (await res.json().catch(() => ({}))) as {
      job?: { id?: string };
      message?: string;
    };
    if (!res.ok || !json.job?.id) {
      this.logger.warn(
        `Canva import refused: ${res.status} ${json.message ?? ''}`,
      );
      throw new BadGatewayException(
        `Canva didn't take the file${json.message ? `: ${json.message}` : '.'}`,
      );
    }
    return json.job.id;
  }

  async importJob(userId: string, jobId: string): Promise<CanvaImportJob> {
    this.requireConfigured();
    const token = await this.accessToken(userId);
    const res = await fetch(
      `${CANVA_API}/imports/${encodeURIComponent(jobId)}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    const json = (await res.json().catch(() => ({}))) as {
      job?: {
        status?: CanvaImportJob['status'];
        result?: {
          designs?: { urls?: { edit_url?: string; view_url?: string } }[];
        };
        error?: { message?: string };
      };
    };
    const job = json.job;
    if (!res.ok || !job?.status) {
      throw new BadGatewayException("Couldn't check the Canva import.");
    }
    const design = job.result?.designs?.[0];
    return {
      status: job.status,
      editUrl: design?.urls?.edit_url,
      viewUrl: design?.urls?.view_url,
      error: job.error?.message,
    };
  }
}
