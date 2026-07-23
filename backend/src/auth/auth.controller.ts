import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  Logger,
  Req,
  Res,
} from '@nestjs/common';
import type { Request, Response as ExpressResponse } from 'express';
import { ConfigService } from '@nestjs/config';
import { SkipThrottle, Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from './jwt-auth.guard';
import { CurrentUser } from './current-user.decorator';
import { AuthUser, AuthService } from './auth.service';
import { CognitoService, CognitoTokens } from './cognito.service';
import { RecaptchaService } from './recaptcha.service';
import { AuthLockoutService } from './auth-lockout.service';
import { UserRole } from '@prisma/client';
import {
  clearSessionCookie,
  getSessionTokenFromRequest,
  setSessionCookie,
} from './session-cookie';
import { isProductionEnv } from '../utils/is-production-env';

/** Supabase/GoTrue external call timeout (ms). Prevents login hanging on slow/unreachable auth. */
const SUPABASE_FETCH_TIMEOUT_MS = 15000;

async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    return res;
  } finally {
    clearTimeout(timeout);
  }
}

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
}

@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);
  private readonly supabaseAuthDecommissioned: boolean;

  constructor(
    private readonly authService: AuthService,
    private readonly cognitoService: CognitoService,
    private readonly recaptchaService: RecaptchaService,
    private readonly lockout: AuthLockoutService,
    private readonly configService: ConfigService,
  ) {
    this.supabaseAuthDecommissioned =
      this.configService.get<boolean>('supabase.authDecommissioned') ?? true;
  }

  private clientIp(req: Request): string {
    return (req.ip || '').trim() || 'unknown';
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
      mfaEnabled = await this.cognitoService.isSoftwareTokenMfaEnabled(
        tokens.accessToken,
      );
    } catch (err) {
      this.logger.warn(
        `[Auth] MFA status on login failed for ${user.email}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
    const mfaEnrollmentRequired =
      user.role === UserRole.ADMIN && !mfaEnabled;

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
    | { error: string }
    | { challenge: 'SOFTWARE_TOKEN_MFA'; session: string }
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
      return loginResult;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Login failed.';
      this.logger.warn(
        `[Auth] Cognito login failed for ${emailStr} after ${Date.now() - loginStart}ms: ${msg}`,
      );
      const lock = await this.lockout.recordFailure('login', emailStr, ip);
      if (lock.locked) {
        return { error: lock.message || 'Too many attempts. Please try again later.' };
      }
      if (/not authorized|incorrect username or password/i.test(msg)) {
        return { error: 'Invalid email or password.' };
      }
      if (/aborted|timeout|TimeoutError/i.test(msg)) {
        return {
          error: 'Login timed out. Please try again.',
        };
      }
      return { error: msg };
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
      return loginResult;
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'MFA verification failed.';
      this.logger.warn(`[Auth] Cognito MFA failed for ${emailStr}: ${msg}`);
      const lock = await this.lockout.recordFailure('mfa', emailStr, ip);
      if (lock.locked) {
        return { error: lock.message || 'Too many attempts. Please try again later.' };
      }
      return { error: msg };
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
      return loginResult;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'OAuth login failed.';
      this.logger.warn(`[Auth] Cognito callback failed: ${msg}`);
      return { error: msg };
    }
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
    if (password.length < 8) {
      return { error: 'Password must be at least 8 characters.' };
    }
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
        city || null,
        state || null,
        zipCode || null,
      );

      await this.cognitoService.syncGroupsForRole(emailStr, UserRole.HCP);

      this.logger.log(`[Auth] Cognito signup success for ${emailStr}`);
      return { userConfirmed: signup.userConfirmed };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Sign up failed.';
      this.logger.warn(`[Auth] Cognito signup failed for ${emailStr}: ${msg}`);
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
   * Proxies to GoTrue signup (avoids CORS when frontend calls from localhost).
   */
  @SkipThrottle({ short: true, medium: true, long: true, authMfa: true })
  @Throttle({ auth: { limit: 10, ttl: 900_000 } })
  @Post('signup')
  async signup(
    @Req() req: Request,
    @Body('email') email: string,
    @Body('password') password: string,
    @Body('firstName') firstName?: string,
    @Body('lastName') lastName?: string,
    @Body('profession') profession?: string,
    @Body('npiNumber') npiNumber?: string,
    @Body('institution') institution?: string,
    @Body('city') city?: string,
    @Body('state') state?: string,
    @Body('zipCode') zipCode?: string,
  ): Promise<{ error?: string }> {
    if (this.supabaseAuthDecommissioned) {
      return {
        error:
          'New account creation is temporarily disabled while auth is migrating. Please contact support.',
      };
    }

    const emailStr = (email || '').trim();
    const ip = this.clientIp(req);
    const locked = await this.rejectIfLocked('signup', emailStr, ip);
    if (locked) return locked;
    if (!emailStr) return { error: 'Email is required.' };
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailStr))
      return { error: 'Please enter a valid email address.' };
    if (!password) return { error: 'Password is required.' };
    if (password.length < 8)
      return { error: 'Password must be at least 8 characters.' };
    if (!firstName?.trim()) return { error: 'First name is required.' };
    if (!lastName?.trim()) return { error: 'Last name is required.' };
    if (!profession?.trim()) return { error: 'Profession is required.' };

    const professionTrim = profession.trim();
    /** Same role list as Join.tsx NPI_REQUIRED_PROFESSIONS */
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
    if (!npiOptional && npi.length !== 10)
      return { error: 'NPI number must be 10 digits.' };
    if (npiOptional && npi.length > 0 && npi.length !== 10) {
      return { error: 'If provided, NPI must be exactly 10 digits.' };
    }

    const supabaseUrl = this.configService.get<string>('supabase.url');
    const supabaseAnon = this.configService.get<string>('supabase.anonKey');

    if (!supabaseUrl || !supabaseAnon) {
      return { error: 'Sign up is not configured. Contact support.' };
    }

    const signupStart = Date.now();
    this.logger.log(`[Auth] Signup attempt for email: ${emailStr}`);
    let res: Response;
    try {
      res = await fetchWithTimeout(
        `${supabaseUrl.replace(/\/$/, '')}/auth/v1/signup`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            apikey: supabaseAnon,
          },
          body: JSON.stringify({
            email: emailStr,
            password,
            data: {
              first_name: (firstName || '').trim(),
              last_name: (lastName || '').trim(),
              full_name: [firstName, lastName]
                .map((s) => (s || '').trim())
                .filter(Boolean)
                .join(' '),
              profession,
              npi_number: npiOptional ? npi || undefined : npi,
              institution: (institution || '').trim() || undefined,
              city: (city || '').trim() || undefined,
              state: (state || '').trim() || undefined,
              zip_code: (zipCode || '').trim() || undefined,
            },
          }),
        },
        SUPABASE_FETCH_TIMEOUT_MS,
      );
    } catch (err) {
      const msg =
        err instanceof Error && err.name === 'AbortError'
          ? 'Sign up request timed out. Please try again.'
          : 'Sign up failed. Please try again.';
      this.logger.warn(
        `[Auth] Signup error for ${emailStr} after ${Date.now() - signupStart}ms:`,
        err,
      );
      await this.lockout.recordFailure('signup', emailStr, ip);
      return { error: msg };
    }
    this.logger.log(
      `[Auth] Supabase signup fetch completed in ${Date.now() - signupStart}ms`,
    );
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      const msg =
        data?.msg ||
        data?.error_description ||
        data?.error ||
        'Sign up failed. Please try again.';
      this.logger.warn(`[Auth] Signup failed for ${emailStr}: ${msg}`);
      if (msg.toLowerCase().includes('confirmation mail')) {
        this.logger.log(
          `[Auth] Signup likely succeeded for ${emailStr} (email send failed)`,
        );
        await this.lockout.recordSuccess('signup', emailStr, ip);
        return {};
      }
      // GoTrue often returns "User already registered" — do not leak that to clients.
      if (
        /already\s+(registered|exists)|user.*exist|email.*exist/i.test(
          String(msg),
        )
      ) {
        await this.lockout.recordSuccess('signup', emailStr, ip);
        return {};
      }
      const lock = await this.lockout.recordFailure('signup', emailStr, ip);
      if (lock.locked) {
        return { error: lock.message || 'Too many attempts. Please try again later.' };
      }
      return { error: msg };
    }

    this.logger.log(`[Auth] Signup success for ${emailStr}`);
    await this.lockout.recordSuccess('signup', emailStr, ip);
    return {};
  }

  /**
   * POST /api/auth/login-oauth
   * Exchange GoTrue OAuth access_token (Google/Apple) for CHT session.
   * Body: { access_token: string }
   * Validates the token against GoTrue /auth/v1/user instead of local JWT verify,
   * so it works regardless of signing algorithm (HS256 or ES256).
   */
  @Post('login-oauth')
  async loginOAuth(
    @Body('access_token') accessToken: string,
    @Res({ passthrough: true }) res: ExpressResponse,
  ): Promise<LoginSuccess | { error: string }> {
    if (this.supabaseAuthDecommissioned) {
      return {
        error:
          'Google OAuth is temporarily disabled while auth is migrating. Please sign in with email/password.',
      };
    }

    const token = accessToken?.trim();
    if (!token) {
      return { error: 'access_token is required.' };
    }

    const supabaseUrl = this.configService.get<string>('supabase.url');
    const supabaseAnon = this.configService.get<string>('supabase.anonKey');
    if (!supabaseUrl || !supabaseAnon) {
      this.logger.warn('[Auth] login-oauth: Supabase not configured');
      return { error: 'OAuth login is not configured.' };
    }

    let userData: {
      id?: string;
      email?: string;
      user_metadata?: Record<string, unknown>;
    };
    try {
      const res = await fetchWithTimeout(
        `${supabaseUrl.replace(/\/$/, '')}/auth/v1/user`,
        {
          method: 'GET',
          headers: {
            apikey: supabaseAnon,
            Authorization: `Bearer ${token}`,
          },
        },
        SUPABASE_FETCH_TIMEOUT_MS,
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        const msg = (body as { msg?: string })?.msg || res.statusText;
        this.logger.warn(
          `[Auth] login-oauth GoTrue rejected token: ${res.status} ${msg}`,
        );
        return { error: 'Invalid or expired token.' };
      }
      userData = await res.json();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`[Auth] login-oauth GoTrue fetch failed: ${msg}`);
      return { error: 'Could not verify token. Please try again.' };
    }

    const authId = userData?.id;
    if (!authId) return { error: 'Invalid token.' };

    const meta = (userData.user_metadata || {}) as Record<string, string>;
    const firstName =
      meta.first_name ||
      (meta.full_name ? String(meta.full_name).split(' ')[0] : undefined);
    const lastName =
      meta.last_name ||
      (meta.full_name
        ? String(meta.full_name).split(' ').slice(1).join(' ')
        : undefined);

    const user = await this.authService.findOrCreateByAuthId(
      authId,
      userData.email,
      firstName || meta.full_name,
      lastName,
      meta.npi_number || null,
      meta.profession || meta.specialty || null,
      meta.institution || null,
      meta.city || null,
      meta.state || null,
      meta.zip_code || null,
    );
    if (!user) return { error: 'User not found.' };

    const sessionToken = await this.authService.createSession(user, token);
    const dbUser = await this.authService.getUserById(user.userId);
    const profileComplete = this.authService.isProfileComplete(dbUser);

    this.logger.log(
      `[Auth] OAuth login success: userId=${user.userId} email=${user.email}`,
    );
    this.attachSessionCookie(res, sessionToken);
    return {
      session_token: sessionToken,
      access_token: token,
      userId: user.userId,
      email: user.email,
      name: user.name,
      firstName: dbUser?.firstName ?? firstName ?? 'User',
      lastName: dbUser?.lastName ?? lastName ?? '',
      role: user.role,
      profileComplete,
    };
  }

  /**
   * POST /api/auth/login
   * Validates email/password against Supabase when configured.
   * When Supabase not configured (dev only): lookup by email in DB, password
   * ignored — for local development against a seeded DB. Production refuses
   * the DB-fallback path outright (SCRUM-101).
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

    const supabaseUrl = this.configService.get<string>('supabase.url');
    const supabaseAnon = this.configService.get<string>('supabase.anonKey');

    if (supabaseUrl && supabaseAnon) {
      const loginStart = Date.now();
      this.logger.log(
        `[Auth] Login attempt via Supabase for email: ${emailStr}`,
      );
      let res: Response;
      try {
        const supabaseStart = Date.now();
        res = await fetchWithTimeout(
          `${supabaseUrl.replace(/\/$/, '')}/auth/v1/token?grant_type=password`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              apikey: supabaseAnon,
            },
            body: JSON.stringify({ email: emailStr, password: password || '' }),
          },
          SUPABASE_FETCH_TIMEOUT_MS,
        );
        this.logger.log(
          `[Auth] Supabase fetch completed in ${Date.now() - supabaseStart}ms (status=${res.status})`,
        );
      } catch (err) {
        const msg =
          err instanceof Error && err.name === 'AbortError'
            ? 'Login request timed out. Please try again.'
            : 'Login failed. Please try again.';
        this.logger.warn(
          `[Auth] Supabase login error for ${emailStr} after ${Date.now() - loginStart}ms:`,
          err,
        );
        await this.lockout.recordFailure('login', emailStr, ip);
        return { error: msg };
      }
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        const msg =
          data?.error_description || data?.msg || 'Invalid email or password.';
        this.logger.warn(
          `[Auth] Supabase login failed for ${emailStr}: ${msg}`,
        );
        const lock = await this.lockout.recordFailure('login', emailStr, ip);
        if (lock.locked) {
          return {
            error:
              lock.message || 'Too many attempts. Please try again later.',
          };
        }
        return { error: msg };
      }

      const authId = data?.user?.id;
      if (!authId) {
        await this.lockout.recordFailure('login', emailStr, ip);
        return { error: 'Login failed.' };
      }

      const metadata = data.user?.user_metadata || {};
      const firstName = metadata.first_name || 'User';
      const lastName = metadata.last_name || '';
      const npiNumber = metadata.npi_number || null;
      const specialty = metadata.profession || metadata.specialty || null;

      const dbStart = Date.now();
      const user = await this.authService.findOrCreateByAuthId(
        authId,
        data.user?.email,
        firstName,
        lastName,
        npiNumber,
        specialty,
        metadata.institution || null,
        metadata.city || null,
        metadata.state || null,
        metadata.zip_code || null,
      );
      this.logger.log(
        `[Auth] findOrCreateByAuthId completed in ${Date.now() - dbStart}ms`,
      );

      if (!user) {
        await this.lockout.recordFailure('login', emailStr, ip);
        return { error: 'User not found.' };
      }

      const sessionStart = Date.now();
      const sessionToken = await this.authService.createSession(
        user,
        data.access_token,
      );
      this.logger.log(
        `[Auth] createSession completed in ${Date.now() - sessionStart}ms`,
      );

      const dbUser = await this.authService.getUserById(user.userId);
      const profileComplete = this.authService.isProfileComplete(dbUser);
      this.logger.log(
        `[Auth] Supabase login success: userId=${user.userId} email=${user.email} total=${Date.now() - loginStart}ms`,
      );
      await this.lockout.recordSuccess('login', emailStr, ip);
      this.attachSessionCookie(expressRes, sessionToken);
      return {
        session_token: sessionToken,
        access_token: data.access_token,
        userId: user.userId,
        email: user.email,
        name: user.name,
        firstName: dbUser?.firstName ?? firstName,
        lastName: dbUser?.lastName ?? lastName,
        role: user.role,
        profileComplete,
      };
    }

    // SCRUM-101: fail-closed in production. The dev-fallback path below logs
    // a user in by email with the password IGNORED — a critical vulnerability
    // if SUPABASE_URL/SUPABASE_ANON_KEY are ever missing in prod (config
    // drift, secret rotation, misdeploy). Never allow this path outside of
    // local/test environments.
    if (isProductionEnv()) {
      this.logger.warn(
        `[Auth] Login refused: Supabase env not configured in production for ${emailStr}`,
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
   * Proxies to GoTrue password reset (avoids CORS).
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

    const supabaseUrl = this.configService.get<string>('supabase.url');
    const supabaseAnon = this.configService.get<string>('supabase.anonKey');

    if (!supabaseUrl || !supabaseAnon) {
      return { error: 'Password reset is not configured.' };
    }

    const recoverStart = Date.now();
    this.logger.log(`[Auth] Password reset request for: ${emailStr}`);
    let res: Response;
    try {
      res = await fetchWithTimeout(
        `${supabaseUrl.replace(/\/$/, '')}/auth/v1/recover`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            apikey: supabaseAnon,
          },
          body: JSON.stringify({ email: emailStr }),
        },
        SUPABASE_FETCH_TIMEOUT_MS,
      );
    } catch (err) {
      const msg =
        err instanceof Error && err.name === 'AbortError'
          ? 'Request timed out. Please try again.'
          : 'Password reset failed. Please try again.';
      this.logger.warn(
        `[Auth] Recover error for ${emailStr} after ${Date.now() - recoverStart}ms:`,
        err,
      );
      await this.lockout.recordFailure('recover', emailStr, ip);
      return { error: msg };
    }
    this.logger.log(
      `[Auth] Supabase recover fetch completed in ${Date.now() - recoverStart}ms`,
    );
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      const msg =
        data?.msg || data?.error_description || 'Password reset failed.';
      this.logger.warn(`[Auth] Recover failed for ${emailStr}: ${msg}`);
      const lock = await this.lockout.recordFailure('recover', emailStr, ip);
      if (lock.locked) {
        return {
          error: lock.message || 'Too many attempts. Please try again later.',
        };
      }
      return { error: msg };
    }

    this.logger.log(`[Auth] Recover email sent to ${emailStr}`);
    await this.lockout.recordFailure('recover', emailStr, ip);
    return {};
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
      return { secretCode, otpauthUri };
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'Could not start MFA setup.';
      this.logger.warn(`[Auth] MFA setup failed for ${user.email}: ${msg}`);
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
    if (sessionToken) {
      await this.authService.revokeSession(sessionToken);
    }
    clearSessionCookie(res, this.configService.get<string>('nodeEnv'));
    return { ok: true };
  }

  /**
   * GET /api/auth/chatbot-token
   * Returns GoTrue JWT for chatbot (unlimited queries). Requires session auth.
   */
  @Get('chatbot-token')
  @UseGuards(JwtAuthGuard)
  async getChatbotToken(@CurrentUser() user: AuthUser, @Req() req: Request) {
    void user;
    const sessionToken = getSessionTokenFromRequest(req);
    if (!sessionToken) return { token: null };
    const token = await this.authService.getChatbotToken(sessionToken);
    return { token };
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
      if (accessToken) {
        try {
          mfaEnabled =
            await this.cognitoService.isSoftwareTokenMfaEnabled(accessToken);
        } catch (err) {
          this.logger.warn(
            `[Auth] MFA status check failed for ${user.email}: ${err instanceof Error ? err.message : String(err)}`,
          );
        }
      }
    }

    // Soft enforce for admins while pool MFA is OPTIONAL: require enrollment
    // before using admin surfaces. Flip pool to ON later for all users.
    const mfaEnrollmentRequired =
      user.role === UserRole.ADMIN &&
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
    };
  }
}
