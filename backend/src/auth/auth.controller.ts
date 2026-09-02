import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseGuards,
  Logger,
  Req,
  Res,
  ForbiddenException,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { Request, Response as ExpressResponse } from 'express';
import { ConfigService } from '@nestjs/config';
import { SkipThrottle, Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from './jwt-auth.guard';
import { CurrentUser } from './current-user.decorator';
import { AuthUser, AuthService } from './auth.service';
import { CognitoService, CognitoTokens } from './cognito.service';
import {
  cognitoErrorLogFields,
  mapCognitoLoginException,
  type MappedCognitoLoginError,
} from './cognito-login-errors';
import { RecaptchaService } from './recaptcha.service';
import { AuthLockoutService } from './auth-lockout.service';
import { NpiRegistryService } from './npi-registry.service';
import { UserRole } from '@prisma/client';
import {
  clearSessionCookie,
  getSessionTokenFromRequest,
  setSessionCookie,
} from './session-cookie';
import {
  normalizeUsStateCode,
  normalizeUsZip5,
  validateRegistrationLocation,
} from '../common/us-address';

function passwordMeetsSignupPolicy(password: string): string | null {
  if (!password || password.length < 8) {
    return 'Password must be at least 8 characters.';
  }
  if (!/[A-Z]/.test(password)) {
    return 'Password must include at least one capital letter.';
  }
  if (!/[a-z]/.test(password)) {
    return 'Password must include at least one lowercase letter.';
  }
  if (!/\d/.test(password)) {
    return 'Password must include at least one number.';
  }
  if (!/[^A-Za-z0-9]/.test(password)) {
    return 'Password must include at least one symbol.';
  }
  return null;
}
import { isProductionEnv } from '../utils/is-production-env';
import { AuditService } from '../audit/audit.service';
import type { Prisma } from '@prisma/client';
import { FeatureFlagsService } from '../feature-flags/feature-flags.service';
import type { MfaFeatureFlags } from '../feature-flags/feature-flags.types';

interface LoginSuccess {
  session_token: string;
  /** Cognito/legacy access token for server-side use cases; not a refresh credential. */
  access_token?: string;
  userId: string;
  email: string;
  name: string;
  firstName?: string;
  lastName?: string;
  role: string;
  profileComplete?: boolean;
  mfaEnabled?: boolean;
  mfaEnrollmentRequired?: boolean;
  mfaFeature?: MfaFeatureFlags;
}

@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(
    private readonly authService: AuthService,
    private readonly cognitoService: CognitoService,
    private readonly recaptchaService: RecaptchaService,
    private readonly lockout: AuthLockoutService,
    private readonly npiRegistry: NpiRegistryService,
    private readonly configService: ConfigService,
    private readonly audit: AuditService,
    private readonly featureFlags: FeatureFlagsService,
  ) {}

  private clientIp(req: Request): string {
    return (req.ip || '').trim() || 'unknown';
  }

  private requestUserAgent(req: Request): string | null {
    const ua = req.headers?.['user-agent'];
    return typeof ua === 'string' ? ua : null;
  }

  private auditAuthEvent(
    req: Request,
    action: string,
    actor?: {
      userId?: string | null;
      email?: string | null;
      role?: string | null;
    },
    metadata?: Record<string, unknown>,
  ): void {
    this.audit.record({
      actorId: actor?.userId?.trim() || 'anonymous',
      actorEmail: actor?.email ?? null,
      actorRole: actor?.role ?? (actor?.userId ? null : 'anonymous'),
      action,
      resource: 'auth',
      metadata: metadata as Prisma.InputJsonValue | undefined,
      ipAddress: this.clientIp(req),
      userAgent: this.requestUserAgent(req),
    });
  }

  /**
   * MFA enrollment gate from AppConfig `mfa.enabled` (default off until SMS/10DLC is ready).
   */
  private isMfaEnrollmentEnforced(): boolean {
    return this.featureFlags.isMfaEnrollmentEnabled();
  }

  private mfaFeaturePayload(): MfaFeatureFlags {
    return this.featureFlags.getAuthFeatures().mfa;
  }

  private assertMfaEnrollmentAllowed(): void {
    if (!this.featureFlags.isMfaEnrollmentEnabled()) {
      throw new ForbiddenException(
        'Multi-factor authentication enrollment is not available yet.',
      );
    }
  }

  private async rejectIfLocked(
    action: 'login' | 'mfa' | 'signup' | 'recover',
    email: string,
    ip: string,
  ): Promise<{ error: string } | null> {
    const check = await this.lockout.assertAllowed(action, email, ip);
    if (!check.locked) return null;
    return { error: check.message || 'Too many attempts. Please try again later.' };
  }

  private attachSessionCookie(
    res: ExpressResponse,
    sessionToken: string,
  ): void {
    // Cookie Max-Age tracks absolute lifetime; idle expiry is enforced server-side
    // and slid on getSession. Using idle TTL here would drop active users at 30m.
    const ttl =
      this.configService.get<number>('sessionAbsoluteTtlSeconds') ?? 28800;
    const nodeEnv = this.configService.get<string>('nodeEnv');
    setSessionCookie(res, sessionToken, ttl, nodeEnv);
  }

  private async verifyRecaptchaOrError(
    token: string | undefined,
    action: 'login' | 'signup',
    req: Request,
  ): Promise<string | null> {
    const result = await this.recaptchaService.verify(
      token,
      action,
      req.ip,
    );
    return 'error' in result ? result.error : null;
  }

  private async sessionFromCognitoTokens(
    tokens: CognitoTokens,
    res: ExpressResponse,
    profile?: {
      firstName?: string;
      lastName?: string;
      npiNumber?: string | null;
      specialty?: string | null;
      institution?: string | null;
      city?: string | null;
      state?: string | null;
      zipCode?: string | null;
    },
  ): Promise<LoginSuccess | { error: string }> {
    let claims;
    try {
      claims = await this.cognitoService.verifyTokenPair(tokens);
    } catch (err) {
      this.logger.warn(
        `[Auth] Cognito token verification failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      return { error: 'Invalid token.' };
    }

    const authId = claims.sub;
    if (!authId) return { error: 'Invalid token.' };

    const user = await this.authService.findOrCreateByAuthId(
      authId,
      claims.email,
      profile?.firstName || claims.given_name,
      profile?.lastName || claims.family_name,
      profile?.npiNumber ?? null,
      profile?.specialty ?? null,
      profile?.institution ?? null,
      profile?.city ?? null,
      profile?.state ?? null,
      profile?.zipCode ?? null,
    );
    if (!user) return { error: 'User not found.' };

    void this.cognitoService
      .syncGroupsForRole(
        user.email,
        user.role,
        claims['cognito:username'] || claims.sub,
      )
      .catch((err) =>
        this.logger.warn(
          `[Auth] Cognito group sync on login failed for ${user.email}: ${err}`,
        ),
      );

    const sessionToken = await this.authService.createSession(
      user,
      tokens.accessToken,
    );
    const dbUser = await this.authService.getUserById(user.userId);
    const profileComplete = this.authService.isProfileComplete(dbUser);

    let mfaEnabled = false;
    try {
      mfaEnabled =
        await this.cognitoService.isSoftwareTokenMfaEnabledFromAccessToken(
          tokens.accessToken,
        );
    } catch (err) {
      this.logger.warn(
        `[Auth] MFA status on login failed for ${user.email}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
    const mfaEnrollmentRequired =
      this.isMfaEnrollmentEnforced() &&
      this.cognitoService.isConfigured() &&
      !mfaEnabled;

    this.attachSessionCookie(res, sessionToken);
    return {
      session_token: sessionToken,
      access_token: tokens.accessToken,
      userId: user.userId,
      email: user.email,
      name: user.name,
      firstName: dbUser?.firstName ?? profile?.firstName ?? claims.given_name ?? 'User',
      lastName: dbUser?.lastName ?? profile?.lastName ?? claims.family_name ?? '',
      role: user.role,
      profileComplete,
      mfaEnabled,
      mfaEnrollmentRequired,
      mfaFeature: this.mfaFeaturePayload(),
    };
  }

  /**
   * POST /api/auth/cognito/login
   * Email/password via Cognito USER_PASSWORD_AUTH → Postgres session cookie.
   */
  @SkipThrottle({ short: true, medium: true, long: true, authMfa: true })
  @Throttle({ auth: { limit: 10, ttl: 900_000 } })
  @Post('cognito/login')
  async cognitoLogin(
    @Body('email') email: string,
    @Body('password') password: string,
    @Body('recaptchaToken') recaptchaToken: string | undefined,
    @Req() req: Request,
    @Res({ passthrough: true }) res: ExpressResponse,
  ): Promise<
    | LoginSuccess
    | MappedCognitoLoginError
    | { error: string }
    | { challenge: 'SOFTWARE_TOKEN_MFA'; session: string }
    | {
        challenge: 'MFA_SETUP';
        session: string;
        secretCode: string;
        otpauthUri: string;
      }
  > {
    const loginStart = Date.now();
    const emailStr = (email || '').trim();
    const ip = this.clientIp(req);
    this.logger.log(
      `[Auth] Cognito login attempt for ${emailStr || '(empty)'} captcha=${recaptchaToken ? 'present' : 'missing'}`,
    );

    if (!this.cognitoService.isConfigured()) {
      return { error: 'Cognito login is not configured.' };
    }

    const locked = await this.rejectIfLocked('login', emailStr, ip);
    if (locked) return locked;

    const captchaStart = Date.now();
    const captchaError = await this.verifyRecaptchaOrError(
      recaptchaToken,
      'login',
      req,
    );
    this.logger.log(
      `[Auth] Cognito login captcha check for ${emailStr} in ${Date.now() - captchaStart}ms` +
        (captchaError ? ` failed: ${captchaError}` : ''),
    );
    if (captchaError) {
      return { error: captchaError };
    }

    if (!emailStr) return { error: 'Email is required.' };
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailStr)) {
      return { error: 'Please enter a valid email address.' };
    }
    if (!password) return { error: 'Password is required.' };

    try {
      const cognitoStart = Date.now();
      const result = await this.cognitoService.loginWithPassword(
        emailStr,
        password,
      );
      this.logger.log(
        `[Auth] Cognito InitiateAuth for ${emailStr} in ${Date.now() - cognitoStart}ms kind=${result.kind}`,
      );
      if (result.kind === 'mfa') {
        await this.lockout.recordSuccess('login', emailStr, ip);
        return {
          challenge: result.challenge,
          session: result.session,
        };
      }
      if (result.kind === 'mfa_setup') {
        await this.lockout.recordSuccess('login', emailStr, ip);
        this.logger.log(
          `[Auth] Cognito MFA_SETUP for ${emailStr} in ${Date.now() - cognitoStart}ms`,
        );
        return {
          challenge: 'MFA_SETUP',
          session: result.session,
          secretCode: result.secretCode,
          otpauthUri: this.cognitoService.buildOtpauthUri(
            result.secretCode,
            emailStr,
          ),
        };
      }
      const sessionStart = Date.now();
      const loginResult = await this.sessionFromCognitoTokens(
        result.tokens,
        res,
      );
      this.logger.log(
        `[Auth] Cognito session create for ${emailStr} in ${Date.now() - sessionStart}ms`,
      );
      if ('error' in loginResult) {
        await this.lockout.recordFailure('login', emailStr, ip);
        return loginResult;
      }
      await this.lockout.recordSuccess('login', emailStr, ip);
      this.logger.log(
        `[Auth] Cognito login success: userId=${loginResult.userId} email=${loginResult.email} total=${Date.now() - loginStart}ms`,
      );
      this.auditAuthEvent(req, 'auth.login', {
        userId: loginResult.userId,
        email: loginResult.email,
        role: loginResult.role,
      }, { method: 'cognito' });
      return loginResult;
    } catch (err) {
      const fields = cognitoErrorLogFields(err);
      this.logger.warn(
        `[Auth] Cognito login failed for ${emailStr} after ${Date.now() - loginStart}ms` +
          ` name=${fields.name}` +
          (fields.challenge ? ` challenge=${fields.challenge}` : '') +
          ` msg=${fields.message}`,
      );
      const lock = await this.lockout.recordFailure('login', emailStr, ip);
      if (lock.locked) {
        return {
          error: lock.message || 'Too many attempts. Please try again later.',
          code: 'RATE_LIMITED',
        };
      }
      return mapCognitoLoginException(err);
    }
  }

  /**
   * POST /api/auth/cognito/mfa
   * Complete SOFTWARE_TOKEN_MFA challenge after cognito/login.
   */
  @SkipThrottle({ short: true, medium: true, long: true, auth: true })
  @Throttle({ authMfa: { limit: 5, ttl: 300_000 } })
  @Post('cognito/mfa')
  async cognitoMfa(
    @Body('email') email: string,
    @Body('session') session: string,
    @Body('code') code: string,
    @Req() req: Request,
    @Res({ passthrough: true }) res: ExpressResponse,
  ): Promise<LoginSuccess | { error: string }> {
    if (!this.cognitoService.isConfigured()) {
      return { error: 'Cognito login is not configured.' };
    }

    const emailStr = (email || '').trim();
    const sessionStr = (session || '').trim();
    const codeStr = (code || '').trim();
    const ip = this.clientIp(req);
    if (!emailStr) return { error: 'Email is required.' };
    if (!sessionStr) return { error: 'MFA session is required.' };
    if (!codeStr) return { error: 'MFA code is required.' };

    const locked = await this.rejectIfLocked('mfa', emailStr, ip);
    if (locked) return locked;

    try {
      const tokens = await this.cognitoService.respondToMfaChallenge(
        sessionStr,
        codeStr,
        emailStr,
      );
      const loginResult = await this.sessionFromCognitoTokens(tokens, res);
      if ('error' in loginResult) {
        await this.lockout.recordFailure('mfa', emailStr, ip);
        return loginResult;
      }
      await this.lockout.recordSuccess('mfa', emailStr, ip);
      this.logger.log(
        `[Auth] Cognito MFA login success: userId=${loginResult.userId} email=${loginResult.email}`,
      );
      this.auditAuthEvent(req, 'auth.mfa_login', {
        userId: loginResult.userId,
        email: loginResult.email,
        role: loginResult.role,
      }, { method: 'cognito' });
      return loginResult;
    } catch (err) {
      const fields = cognitoErrorLogFields(err);
      this.logger.warn(
        `[Auth] Cognito MFA failed for ${emailStr} name=${fields.name}` +
          (fields.challenge ? ` challenge=${fields.challenge}` : '') +
          ` msg=${fields.message}`,
      );
      const lock = await this.lockout.recordFailure('mfa', emailStr, ip);
      if (lock.locked) {
        return { error: lock.message || 'Too many attempts. Please try again later.' };
      }
      return mapCognitoLoginException(err);
    }
  }

  /**
   * POST /api/auth/cognito/mfa/setup
   * Complete MFA_SETUP after cognito/login returned a TOTP secret (no session yet).
   */
  @SkipThrottle({ short: true, medium: true, long: true, auth: true })
  @Throttle({ authMfa: { limit: 5, ttl: 300_000 } })
  @Post('cognito/mfa/setup')
  async cognitoMfaSetup(
    @Body('email') email: string,
    @Body('session') session: string,
    @Body('code') code: string,
    @Req() req: Request,
    @Res({ passthrough: true }) res: ExpressResponse,
  ): Promise<LoginSuccess | MappedCognitoLoginError | { error: string }> {
    if (!this.cognitoService.isConfigured()) {
      return { error: 'Cognito login is not configured.' };
    }

    this.assertMfaEnrollmentAllowed();

    const emailStr = (email || '').trim();
    const sessionStr = (session || '').trim();
    const codeStr = (code || '').trim();
    const ip = this.clientIp(req);
    if (!emailStr) return { error: 'Email is required.' };
    if (!sessionStr) return { error: 'MFA session is required.' };
    if (!codeStr) return { error: 'MFA code is required.' };

    const locked = await this.rejectIfLocked('mfa', emailStr, ip);
    if (locked) return locked;

    try {
      const tokens = await this.cognitoService.completeMfaSetupChallenge(
        sessionStr,
        codeStr,
        emailStr,
      );
      const loginResult = await this.sessionFromCognitoTokens(tokens, res);
      if ('error' in loginResult) {
        await this.lockout.recordFailure('mfa', emailStr, ip);
        return loginResult;
      }
      await this.lockout.recordSuccess('mfa', emailStr, ip);
      this.logger.log(
        `[Auth] Cognito MFA_SETUP login success: userId=${loginResult.userId} email=${loginResult.email}`,
      );
      this.auditAuthEvent(req, 'auth.mfa_setup_login', {
        userId: loginResult.userId,
        email: loginResult.email,
        role: loginResult.role,
      }, { method: 'cognito' });
      return loginResult;
    } catch (err) {
      const fields = cognitoErrorLogFields(err);
      this.logger.warn(
        `[Auth] Cognito MFA_SETUP failed for ${emailStr} name=${fields.name}` +
          (fields.challenge ? ` challenge=${fields.challenge}` : '') +
          ` msg=${fields.message}`,
      );
      const lock = await this.lockout.recordFailure('mfa', emailStr, ip);
      if (lock.locked) {
        return { error: lock.message || 'Too many attempts. Please try again later.' };
      }
      return mapCognitoLoginException(err);
    }
  }

  /**
   * POST /api/auth/cognito/callback
   * Exchange OAuth authorization code (PKCE) for Postgres session cookie.
   */
  @Post('cognito/callback')
  async cognitoCallback(
    @Body('code') code: string,
    @Body('redirect_uri') redirectUri: string,
    @Body('code_verifier') codeVerifier: string,
    @Req() req: Request,
    @Res({ passthrough: true }) res: ExpressResponse,
  ): Promise<LoginSuccess | { error: string }> {
    if (!this.cognitoService.isConfigured()) {
      return { error: 'Cognito login is not configured.' };
    }

    const codeStr = (code || '').trim();
    const redirect = (redirectUri || '').trim();
    const verifier = (codeVerifier || '').trim();
    if (!codeStr) return { error: 'Authorization code is required.' };
    if (!redirect) return { error: 'redirect_uri is required.' };
    if (!verifier) return { error: 'code_verifier is required.' };

    try {
      const tokens = await this.cognitoService.exchangeAuthorizationCode(
        codeStr,
        redirect,
        verifier,
      );
      const loginResult = await this.sessionFromCognitoTokens(tokens, res);
      if ('error' in loginResult) return loginResult;
      this.logger.log(
        `[Auth] Cognito OAuth login success: userId=${loginResult.userId} email=${loginResult.email}`,
      );
      this.auditAuthEvent(req, 'auth.login', {
        userId: loginResult.userId,
        email: loginResult.email,
        role: loginResult.role,
      }, { method: 'cognito_oauth' });
      return loginResult;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'OAuth login failed.';
      this.logger.warn(`[Auth] Cognito callback failed: ${msg}`);
      return { error: msg };
    }
  }

  /**
   * GET /api/auth/npi/verify?npi=##########
   * Real-time individual NPI check via NIH Clinical Tables (CMS NPPES).
   * Also reports whether the NPI is already registered on CHT.
   */
  @SkipThrottle({ short: true, medium: true, long: true, authMfa: true })
  @Throttle({ auth: { limit: 30, ttl: 300_000 } })
  @Get('npi/verify')
  async verifyNpi(@Query('npi') npiRaw?: string): Promise<{
    valid: boolean;
    npi: string;
    duplicate: boolean;
    providerName?: string;
    providerType?: string;
    practiceAddress?: string;
    error?: string;
  }> {
    const npi = this.npiRegistry.normalizeNpi(npiRaw);
    if (npi.length !== 10) {
      return {
        valid: false,
        npi,
        duplicate: false,
        error: 'NPI number must be exactly 10 digits.',
      };
    }

    const existing = await this.authService.findByNpi(npi);
    const lookup = await this.npiRegistry.lookup(npi);
    if (!lookup.valid) {
      return {
        valid: false,
        npi,
        duplicate: Boolean(existing),
        error: lookup.message,
      };
    }

    return {
      valid: true,
      npi: lookup.npi,
      duplicate: Boolean(existing),
      providerName: lookup.providerName,
      providerType: lookup.providerType,
      practiceAddress: lookup.practiceAddress,
      ...(existing
        ? {
            error:
              'An account with this NPI number already exists. Sign in to your existing account instead.',
          }
        : {}),
    };
  }

  private async assertNpiAllowedForSignup(
    npi: string,
  ): Promise<{ error: string } | null> {
    if (npi.length !== 10) return null;

    const existing = await this.authService.findByNpi(npi);
    if (existing) {
      return {
        error:
          'An account with this NPI number already exists. Sign in to your existing account instead.',
      };
    }

    const lookup = await this.npiRegistry.lookup(npi);
    if (!lookup.valid) {
      return { error: lookup.message };
    }
    return null;
  }

  /**
   * POST /api/auth/cognito/signup
   * Register a Cognito user and create the CHT User row.
   */
  @Post('cognito/signup')
  async cognitoSignup(
    @Body('email') email: string,
    @Body('password') password: string,
    @Body('recaptchaToken') recaptchaToken: string | undefined,
    @Req() req: Request,
    @Body('firstName') firstName?: string,
    @Body('lastName') lastName?: string,
    @Body('profession') profession?: string,
    @Body('npiNumber') npiNumber?: string,
    @Body('institution') institution?: string,
    @Body('city') city?: string,
    @Body('state') state?: string,
    @Body('zipCode') zipCode?: string,
  ): Promise<{ error?: string; userConfirmed?: boolean }> {
    if (!this.cognitoService.isConfigured()) {
      return { error: 'Sign up is not configured. Contact support.' };
    }

    const captchaError = await this.verifyRecaptchaOrError(
      recaptchaToken,
      'signup',
      req,
    );
    if (captchaError) {
      return { error: captchaError };
    }

    const emailStr = (email || '').trim();
    if (!emailStr) return { error: 'Email is required.' };
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailStr)) {
      return { error: 'Please enter a valid email address.' };
    }
    if (!password) return { error: 'Password is required.' };
    const passwordError = passwordMeetsSignupPolicy(password);
    if (passwordError) return { error: passwordError };
    if (!firstName?.trim()) return { error: 'First name is required.' };
    if (!lastName?.trim()) return { error: 'Last name is required.' };
    if (!profession?.trim()) return { error: 'Profession is required.' };

    const professionTrim = profession.trim();
    const npiRequiredProfessions = new Set([
      'Physician',
      'Nurse Practitioner',
      'Physician Assistant',
      'Pharmacist',
      'Nurse',
      'Other HCP',
    ]);
    const npiOptional = !npiRequiredProfessions.has(professionTrim);
    const npi = (npiNumber || '').replace(/\D/g, '');
    if (!npiOptional && npi.length !== 10) {
      return { error: 'NPI number must be 10 digits.' };
    }
    if (npiOptional && npi.length > 0 && npi.length !== 10) {
      return { error: 'If provided, NPI must be exactly 10 digits.' };
    }

    // SCRUM-188 + SCRUM-173: block duplicate NPIs and require registry validation.
    if (npi.length === 10) {
      const npiError = await this.assertNpiAllowedForSignup(npi);
      if (npiError) {
        this.logger.log(
          `[Auth] Cognito signup blocked for ${emailStr}: ${npiError.error}`,
        );
        return npiError;
      }
    }

    const locationError = validateRegistrationLocation({ state, zipCode });
    if (locationError) return { error: locationError };
    const stateNorm = normalizeUsStateCode(state)!;
    const zipNorm = normalizeUsZip5(zipCode)!;
    const cityNorm = (city || '').trim() || null;

    try {
      const signup = await this.cognitoService.signUp(
        emailStr,
        password,
        firstName,
        lastName,
      );

      await this.authService.findOrCreateByAuthId(
        signup.userSub,
        emailStr,
        firstName,
        lastName,
        npiOptional ? npi || null : npi,
        professionTrim,
        institution || null,
        cityNorm,
        stateNorm,
        zipNorm,
      );

      await this.cognitoService.syncGroupsForRole(emailStr, UserRole.HCP);

      this.logger.log(`[Auth] Cognito signup success for ${emailStr}`);
      return { userConfirmed: signup.userConfirmed };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Sign up failed.';
      this.logger.warn(`[Auth] Cognito signup failed for ${emailStr}: ${msg}`);
      // SCRUM-188: race-condition backstop — pre-check + unique constraint
      // both cover the common case; catch the P2002 on npiNumber if two
      // signups collided between the pre-check and the DB write.
      if (/Unique constraint.*npiNumber|P2002.*npiNumber/i.test(msg)) {
        return {
          error:
            'An account with this NPI number already exists. Sign in to your existing account instead.',
        };
      }
      // Do not reveal whether the email is already registered (align with /recover).
      if (/usernameexists|already exists/i.test(msg)) {
        this.logger.log(
          `[Auth] Cognito signup username exists for ${emailStr} — returning generic success`,
        );
        try {
          await this.cognitoService.resendConfirmationCode(emailStr);
        } catch (resendErr) {
          this.logger.debug(
            `[Auth] Cognito resend after duplicate signup skipped for ${emailStr}: ${resendErr instanceof Error ? resendErr.message : String(resendErr)}`,
          );
        }
        return { userConfirmed: false };
      }
      return { error: msg };
    }
  }

  /**
   * POST /api/auth/cognito/confirm
   * Confirm email verification code after Cognito signup.
   */
  @Post('cognito/confirm')
  async cognitoConfirmSignup(
    @Body('email') email: string,
    @Body('code') code: string,
  ): Promise<{ error?: string }> {
    if (!this.cognitoService.isConfigured()) {
      return { error: 'Email verification is not configured. Contact support.' };
    }

    const emailStr = (email || '').trim();
    if (!emailStr) return { error: 'Email is required.' };
    if (!code?.trim()) return { error: 'Verification code is required.' };

    try {
      await this.cognitoService.confirmSignUp(emailStr, code);
      await this.cognitoService.syncGroupsForRole(emailStr, UserRole.HCP);
      this.logger.log(`[Auth] Cognito email confirmed for ${emailStr}`);
      return {};
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Verification failed.';
      this.logger.warn(`[Auth] Cognito confirm failed for ${emailStr}: ${msg}`);
      if (/expired|invalid|mismatch/i.test(msg)) {
        return {
          error:
            'That verification code is invalid or expired. Request a new code and try again.',
        };
      }
      return { error: msg };
    }
  }

  /**
   * POST /api/auth/cognito/resend-code
   */
  @Post('cognito/resend-code')
  async cognitoResendConfirmation(
    @Body('email') email: string,
  ): Promise<{ error?: string }> {
    if (!this.cognitoService.isConfigured()) {
      return { error: 'Email verification is not configured. Contact support.' };
    }

    const emailStr = (email || '').trim();
    if (!emailStr) return { error: 'Email is required.' };

    try {
      await this.cognitoService.resendConfirmationCode(emailStr);
      this.logger.log(`[Auth] Cognito verification code resent for ${emailStr}`);
      return {};
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Could not resend code.';
      this.logger.warn(`[Auth] Cognito resend failed for ${emailStr}: ${msg}`);
      return { error: msg };
    }
  }

  /**
   * POST /api/auth/signup
   * Legacy GoTrue signup removed. Use POST /auth/cognito/signup.
   */
  @SkipThrottle({ short: true, medium: true, long: true, authMfa: true })
  @Throttle({ auth: { limit: 10, ttl: 900_000 } })
  @Post('signup')
  async signup(): Promise<{ error?: string }> {
    return {
      error:
        'Legacy signup is unavailable. Use Cognito signup (/auth/cognito/signup).',
    };
  }

  /**
   * POST /api/auth/login-oauth
   * Legacy GoTrue OAuth exchange removed. Use Cognito Hosted UI + /auth/cognito/callback.
   */
  @Post('login-oauth')
  async loginOAuth(): Promise<{ error: string }> {
    return {
      error:
        'Legacy OAuth login is unavailable. Use Cognito Google sign-in.',
    };
  }

  /**
   * POST /api/auth/login
   * Legacy password login. When Cognito is configured, clients must use
   * POST /auth/cognito/login. Otherwise: local/dev DB fallback only
   * (password ignored). Production refuses the DB-fallback path (SCRUM-101).
   */
  @SkipThrottle({ short: true, medium: true, long: true, authMfa: true })
  @Throttle({ auth: { limit: 10, ttl: 900_000 } })
  @Post('login')
  async login(
    @Body('email') email: string,
    @Body('password') password: string,
    @Req() req: Request,
    @Res({ passthrough: true }) expressRes: ExpressResponse,
  ): Promise<LoginSuccess | { error: string }> {
    const emailStr = (email || '').trim();
    const ip = this.clientIp(req);
    if (!emailStr) return { error: 'Email is required.' };
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailStr))
      return { error: 'Please enter a valid email address.' };
    if (!password) return { error: 'Password is required.' };

    const locked = await this.rejectIfLocked('login', emailStr, ip);
    if (locked) return locked;

    if (this.cognitoService.isConfigured()) {
      throw new ServiceUnavailableException(
        'Legacy login is unavailable. Use Cognito login (/auth/cognito/login).',
      );
    }

    // SCRUM-101: fail-closed in production. The dev-fallback path below logs
    // a user in by email with the password IGNORED.
    if (isProductionEnv()) {
      this.logger.warn(
        `[Auth] Login refused: Cognito not configured in production for ${emailStr}`,
      );
      return { error: 'Login is not available. Please contact support.' };
    }

    this.logger.log(
      `[Auth] Login attempt via dev fallback (DB) for email: ${emailStr}`,
    );
    const user = await this.authService.findByEmail(emailStr);
    if (!user) {
      this.logger.warn(
        `[Auth] Dev login failed: user not found for ${emailStr}`,
      );
      await this.lockout.recordFailure('login', emailStr, ip);
      return { error: 'User not found. Run: cd backend && npx prisma db seed' };
    }
    const sessionToken = await this.authService.createSession(user);
    const dbUser = await this.authService.getUserById(user.userId);
    const profileComplete = this.authService.isProfileComplete(dbUser);
    this.logger.log(
      `[Auth] Dev login success: userId=${user.userId} email=${user.email}`,
    );
    await this.lockout.recordSuccess('login', emailStr, ip);
    this.attachSessionCookie(expressRes, sessionToken);
    this.auditAuthEvent(req, 'auth.login', {
      userId: user.userId,
      email: user.email,
      role: user.role,
    }, { method: 'dev_fallback' });
    return {
      session_token: sessionToken,
      userId: user.userId,
      email: user.email,
      name: user.name,
      role: user.role,
      profileComplete,
    };
  }

  /**
   * POST /api/auth/recover
   * Cognito password reset when configured.
   */
  @SkipThrottle({ short: true, medium: true, long: true, authMfa: true })
  @Throttle({ auth: { limit: 10, ttl: 900_000 } })
  @Post('recover')
  async recover(
    @Body('email') email: string,
    @Req() req: Request,
  ): Promise<{ error?: string }> {
    const emailStr = (email || '').trim();
    if (!emailStr) return { error: 'Email is required.' };
    const ip = this.clientIp(req);

    const locked = await this.rejectIfLocked('recover', emailStr, ip);
    if (locked) return locked;

    if (this.cognitoService.isConfigured()) {
      try {
        await this.cognitoService.forgotPassword(emailStr);
        this.logger.log(`[Auth] Cognito recover email sent to ${emailStr}`);
        // Count every recover attempt (success or fail) to limit email bombing.
        await this.lockout.recordFailure('recover', emailStr, ip);
        this.auditAuthEvent(req, 'auth.recover_requested', {
          email: emailStr,
        }, { method: 'cognito' });
        return {};
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : 'Password reset failed.';
        this.logger.warn(`[Auth] Cognito recover failed for ${emailStr}: ${msg}`);
        const lock = await this.lockout.recordFailure('recover', emailStr, ip);
        if (lock.locked) {
          return {
            error:
              lock.message || 'Too many attempts. Please try again later.',
          };
        }
        // Always return success-shaped response so clients cannot probe for accounts.
        return {};
      }
    }

    return { error: 'Password reset is not configured. Use Cognito.' };
  }

  /**
   * POST /api/auth/recover/confirm
   * Complete Cognito password reset with email verification code.
   */
  @Post('recover/confirm')
  async recoverConfirm(
    @Body('email') email: string,
    @Body('code') code: string,
    @Body('password') password: string,
    @Req() req: Request,
  ): Promise<{ error?: string }> {
    const emailStr = (email || '').trim();
    const codeStr = (code || '').trim();
    const passwordStr = password || '';

    if (!emailStr) return { error: 'Email is required.' };
    if (!codeStr) return { error: 'Reset code is required.' };
    if (!passwordStr || passwordStr.length < 8) {
      return { error: 'Password must be at least 8 characters.' };
    }

    if (this.cognitoService.isConfigured()) {
      const confirmStart = Date.now();
      this.logger.log(`[Auth] Cognito recover confirm attempt for ${emailStr}`);
      try {
        await this.cognitoService.confirmForgotPassword(
          emailStr,
          codeStr,
          passwordStr,
        );
        // Password reset → revoke all existing Postgres + Redis sessions.
        const user = await this.authService.findByEmail(emailStr);
        if (user) {
          const revoked = await this.authService.revokeAllUserSessions(
            user.userId,
          );
          this.logger.log(
            `[Auth] Cognito password reset confirmed for ${emailStr} in ${Date.now() - confirmStart}ms; revokedSessions=${revoked}`,
          );
        } else {
          this.logger.log(
            `[Auth] Cognito password reset confirmed for ${emailStr} in ${Date.now() - confirmStart}ms (no CHT user row yet)`,
          );
        }
        this.auditAuthEvent(req, 'auth.recover_confirmed', {
          userId: user?.userId,
          email: emailStr,
          role: user?.role,
        }, { method: 'cognito' });
        return {};
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Password reset failed.';
        this.logger.warn(
          `[Auth] Cognito recover confirm failed for ${emailStr} after ${Date.now() - confirmStart}ms: ${msg}`,
        );
        if (/CodeMismatchException/i.test(msg)) {
          return { error: 'Invalid reset code.' };
        }
        if (/ExpiredCodeException/i.test(msg)) {
          return {
            error: 'Reset code has expired. Request a new one from Forgot Password.',
          };
        }
        if (/InvalidPasswordException/i.test(msg)) {
          return {
            error:
              'Password does not meet requirements. Use at least 8 characters with upper, lower, number, and symbol.',
          };
        }
        return { error: msg };
      }
    }

    return { error: 'Password reset is not configured.' };
  }

  /**
   * POST /api/auth/cognito/change-password
   * Authenticated Cognito password change. Revokes all sessions after success
   * so stolen cookies cannot keep working with the old password.
   */
  @SkipThrottle({ short: true, medium: true, long: true, authMfa: true })
  @Throttle({ auth: { limit: 10, ttl: 900_000 } })
  @Post('cognito/change-password')
  @UseGuards(JwtAuthGuard)
  async cognitoChangePassword(
    @CurrentUser() user: AuthUser,
    @Body('oldPassword') oldPassword: string,
    @Body('newPassword') newPassword: string,
    @Req() req: Request,
    @Res({ passthrough: true }) res: ExpressResponse,
  ): Promise<{ error?: string } | { ok: true }> {
    if (!this.cognitoService.isConfigured()) {
      return { error: 'Password change is not configured.' };
    }

    const previous = (oldPassword || '').trim();
    const proposed = newPassword || '';
    if (!previous) return { error: 'Current password is required.' };
    if (!proposed || proposed.length < 8) {
      return { error: 'New password must be at least 8 characters.' };
    }

    const sessionToken = getSessionTokenFromRequest(req);
    if (!sessionToken) {
      return { error: 'Session required.' };
    }

    const accessToken =
      await this.authService.getSessionAccessToken(sessionToken);
    if (!accessToken) {
      return {
        error:
          'Password change requires a Cognito session. Please sign out and sign back in, then try again.',
      };
    }

    try {
      await this.cognitoService.changePassword(
        accessToken,
        previous,
        proposed,
      );
      const revoked = await this.authService.revokeAllUserSessions(user.userId);
      clearSessionCookie(res, this.configService.get<string>('nodeEnv'));
      this.logger.log(
        `[Auth] Cognito password changed for ${user.email}; revokedSessions=${revoked}`,
      );
      this.auditAuthEvent(req, 'auth.password_changed', {
        userId: user.userId,
        email: user.email,
        role: user.role,
      });
      return { ok: true };
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'Password change failed.';
      this.logger.warn(
        `[Auth] Cognito change-password failed for ${user.email}: ${msg}`,
      );
      if (/NotAuthorizedException|Incorrect username or password/i.test(msg)) {
        return { error: 'Current password is incorrect.' };
      }
      if (/InvalidPasswordException/i.test(msg)) {
        return {
          error:
            'Password does not meet requirements. Use at least 8 characters with upper, lower, number, and symbol.',
        };
      }
      if (/LimitExceededException/i.test(msg)) {
        return { error: 'Too many attempts. Please try again later.' };
      }
      return { error: msg };
    }
  }

  /**
   * POST /api/auth/mfa/setup
   * Start TOTP enrollment (AssociateSoftwareToken). Requires Cognito access token on session.
   */
  @SkipThrottle({ short: true, medium: true, long: true, authMfa: true })
  @Throttle({ auth: { limit: 10, ttl: 900_000 } })
  @Post('mfa/setup')
  @UseGuards(JwtAuthGuard)
  async mfaSetup(
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ): Promise<
    | { secretCode: string; otpauthUri: string }
    | { error: string }
  > {
    if (!this.cognitoService.isConfigured()) {
      return { error: 'MFA is not configured.' };
    }

    this.assertMfaEnrollmentAllowed();

    const sessionToken = getSessionTokenFromRequest(req);
    if (!sessionToken) return { error: 'Session required.' };

    const accessToken =
      await this.authService.getSessionAccessToken(sessionToken);
    if (!accessToken) {
      return {
        error:
          'MFA setup requires a Cognito session. Please sign out and sign back in, then try again.',
      };
    }

    try {
      const { secretCode } =
        await this.cognitoService.associateSoftwareToken(accessToken);
      const otpauthUri = this.cognitoService.buildOtpauthUri(
        secretCode,
        user.email,
      );
      this.logger.log(`[Auth] MFA setup started for ${user.email}`);
      this.auditAuthEvent(req, 'auth.mfa_setup', {
        userId: user.userId,
        email: user.email,
        role: user.role,
      });
      return { secretCode, otpauthUri };
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'Could not start MFA setup.';
      this.logger.warn(`[Auth] MFA setup failed for ${user.email}: ${msg}`);
      if (/required scopes|NotAuthorizedException/i.test(msg)) {
        return {
          error:
            'Your sign-in session cannot set up MFA yet. Sign out completely, sign back in with Google (or email), then try again.',
        };
      }
      return { error: msg };
    }
  }

  /**
   * POST /api/auth/mfa/verify
   * Confirm TOTP (VerifySoftwareToken) and enable preferred software-token MFA.
   */
  @SkipThrottle({ short: true, medium: true, long: true, auth: true })
  @Throttle({ authMfa: { limit: 5, ttl: 300_000 } })
  @Post('mfa/verify')
  @UseGuards(JwtAuthGuard)
  async mfaVerify(
    @CurrentUser() user: AuthUser,
    @Body('code') code: string,
    @Req() req: Request,
  ): Promise<{ ok?: true; error?: string }> {
    if (!this.cognitoService.isConfigured()) {
      return { error: 'MFA is not configured.' };
    }

    this.assertMfaEnrollmentAllowed();

    const codeStr = (code || '').trim();
    if (!/^\d{6}$/.test(codeStr)) {
      return { error: 'Enter the 6-digit code from your authenticator app.' };
    }

    const sessionToken = getSessionTokenFromRequest(req);
    if (!sessionToken) return { error: 'Session required.' };

    const accessToken =
      await this.authService.getSessionAccessToken(sessionToken);
    if (!accessToken) {
      return {
        error:
          'MFA verification requires a Cognito session. Please sign out and sign back in, then try again.',
      };
    }

    const ip = this.clientIp(req);
    const locked = await this.rejectIfLocked('mfa', user.email, ip);
    if (locked) return locked;

    try {
      await this.cognitoService.verifySoftwareTokenAndEnable(
        accessToken,
        codeStr,
      );
      await this.lockout.recordSuccess('mfa', user.email, ip);
      this.logger.log(`[Auth] MFA enabled for ${user.email}`);
      this.auditAuthEvent(req, 'auth.mfa_enabled', {
        userId: user.userId,
        email: user.email,
        role: user.role,
      });
      return { ok: true };
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'MFA verification failed.';
      this.logger.warn(`[Auth] MFA verify failed for ${user.email}: ${msg}`);
      const lock = await this.lockout.recordFailure('mfa', user.email, ip);
      if (lock.locked) {
        return {
          error: lock.message || 'Too many attempts. Please try again later.',
        };
      }
      if (/CodeMismatchException|EnableSoftwareTokenMFAException/i.test(msg)) {
        return { error: 'Invalid authentication code. Please try again.' };
      }
      return { error: msg };
    }
  }

  @Post('logout')
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: ExpressResponse,
  ) {
    const sessionToken = getSessionTokenFromRequest(req);
    let actor: AuthUser | null = null;
    if (sessionToken) {
      actor = await this.authService.getSession(sessionToken);
      await this.authService.revokeSession(sessionToken);
    }
    clearSessionCookie(res, this.configService.get<string>('nodeEnv'));
    this.auditAuthEvent(req, 'auth.logout', {
      userId: actor?.userId,
      email: actor?.email,
      role: actor?.role,
    });
    return { ok: true };
  }

  /**
   * GET /api/auth/me
   * Returns the current authenticated user's profile (userId, email, firstName, lastName, role).
   * Frontend uses this to get the DB userId for API calls.
   */
  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getMe(@CurrentUser() user: AuthUser, @Req() req: Request) {
    const dbUser = await this.authService.getUserById(user.userId);
    const nameParts = (user.name ?? '').trim().split(/\s+/).filter(Boolean);
    const dbFirst = dbUser?.firstName?.trim();
    const dbLast = dbUser?.lastName?.trim();
    const firstName =
      dbFirst && dbFirst !== 'User'
        ? dbFirst
        : nameParts[0] || dbFirst || 'User';
    const lastName = dbLast
      ? dbLast
      : nameParts.slice(1).join(' ') || dbLast || '';
    const profileComplete = this.authService.isProfileComplete(dbUser);

    let mfaEnabled = false;
    if (this.cognitoService.isConfigured()) {
      const sessionToken = getSessionTokenFromRequest(req);
      const accessToken = sessionToken
        ? await this.authService.getSessionAccessToken(sessionToken)
        : null;
      try {
        if (accessToken) {
          mfaEnabled =
            await this.cognitoService.isSoftwareTokenMfaEnabledFromAccessToken(
              accessToken,
            );
        } else {
          mfaEnabled =
            await this.cognitoService.isSoftwareTokenMfaEnabledForEmail(
              user.email,
            );
        }
      } catch (err) {
        this.logger.warn(
          `[Auth] MFA status check failed for ${user.email}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    // MFA enrollment gate from AppConfig while pool MFA is OPTIONAL.
    const mfaEnrollmentRequired =
      this.isMfaEnrollmentEnforced() &&
      this.cognitoService.isConfigured() &&
      !mfaEnabled;

    this.logger.debug(
      `[Auth] /me OK: userId=${user.userId} email=${user.email} mfaEnabled=${mfaEnabled}`,
    );
    return {
      userId: user.userId,
      authId: user.authId,
      email: user.email,
      name: user.name,
      firstName,
      lastName,
      role: user.role,
      profileComplete,
      mfaEnabled,
      mfaEnrollmentRequired,
      mfaFeature: this.mfaFeaturePayload(),
    };
  }
}
