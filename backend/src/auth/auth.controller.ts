import { Controller, Get, Post, Body, UseGuards, Logger, Req } from '@nestjs/common';
import type { Request } from 'express';
import { ConfigService } from '@nestjs/config';
import * as jwt from 'jsonwebtoken';
import { JwtAuthGuard } from './jwt-auth.guard';
import { CurrentUser } from './current-user.decorator';
import { AuthUser, AuthService } from './auth.service';

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
  access_token?: string;
  refresh_token?: string;
  userId: string;
  email: string;
  name: string;
  firstName?: string;
  lastName?: string;
  role: string;
  profileComplete?: boolean;
}

@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * POST /api/auth/signup
   * Proxies to GoTrue signup (avoids CORS when frontend calls from localhost).
   */
  @Post('signup')
  async signup(
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
    const emailStr = (email || '').trim();
    if (!emailStr) return { error: 'Email is required.' };
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailStr)) return { error: 'Please enter a valid email address.' };
    if (!password) return { error: 'Password is required.' };
    if (password.length < 8) return { error: 'Password must be at least 8 characters.' };
    if (!firstName?.trim()) return { error: 'First name is required.' };
    if (!lastName?.trim()) return { error: 'Last name is required.' };
    if (!profession?.trim()) return { error: 'Profession is required.' };

    const npi = (npiNumber || '').replace(/\D/g, '');
    if (npi.length !== 10) return { error: 'NPI number must be 10 digits.' };

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
            full_name: [firstName, lastName].map((s) => (s || '').trim()).filter(Boolean).join(' '),
            profession,
            npi_number: npi,
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
      const msg = err instanceof Error && err.name === 'AbortError'
        ? 'Sign up request timed out. Please try again.'
        : 'Sign up failed. Please try again.';
      this.logger.warn(`[Auth] Signup error for ${emailStr} after ${Date.now() - signupStart}ms:`, err);
      return { error: msg };
    }
    this.logger.log(`[Auth] Supabase signup fetch completed in ${Date.now() - signupStart}ms`);
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      const msg = data?.msg || data?.error_description || data?.error || 'Sign up failed. Please try again.';
      this.logger.warn(`[Auth] Signup failed for ${emailStr}: ${msg}`);
      if (msg.toLowerCase().includes('confirmation mail')) {
        this.logger.log(`[Auth] Signup likely succeeded for ${emailStr} (email send failed)`);
        return {};
      }
      return { error: msg };
    }

    this.logger.log(`[Auth] Signup success for ${emailStr}`);
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
  async loginOAuth(@Body('access_token') accessToken: string): Promise<LoginSuccess | { error: string }> {
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

    let userData: { id?: string; email?: string; user_metadata?: Record<string, unknown> };
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
        this.logger.warn(`[Auth] login-oauth GoTrue rejected token: ${res.status} ${msg}`);
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
    const firstName = meta.first_name || (meta.full_name ? String(meta.full_name).split(' ')[0] : undefined);
    const lastName = meta.last_name || (meta.full_name ? String(meta.full_name).split(' ').slice(1).join(' ') : undefined);

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

    this.logger.log(`[Auth] OAuth login success: userId=${user.userId} email=${user.email}`);
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
   * When Supabase not configured (dev): lookup by email in DB (password ignored).
   */
  @Post('login')
  async login(
    @Body('email') email: string,
    @Body('password') password: string,
  ): Promise<LoginSuccess | { error: string }> {
    const emailStr = (email || '').trim();
    if (!emailStr) return { error: 'Email is required.' };
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailStr)) return { error: 'Please enter a valid email address.' };
    if (!password) return { error: 'Password is required.' };

    const supabaseUrl = this.configService.get<string>('supabase.url');
    const supabaseAnon = this.configService.get<string>('supabase.anonKey');

    if (supabaseUrl && supabaseAnon) {
      const loginStart = Date.now();
      this.logger.log(`[Auth] Login attempt via Supabase for email: ${emailStr}`);
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
        return { error: msg };
      }
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        const msg = data?.error_description || data?.msg || 'Invalid email or password.';
        this.logger.warn(`[Auth] Supabase login failed for ${emailStr}: ${msg}`);
        return { error: msg };
      }

      const authId = data?.user?.id;
      if (!authId) return { error: 'Login failed.' };

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
      this.logger.log(`[Auth] findOrCreateByAuthId completed in ${Date.now() - dbStart}ms`);

      if (!user) return { error: 'User not found.' };

      const sessionStart = Date.now();
      const sessionToken = await this.authService.createSession(user, data.access_token);
      this.logger.log(`[Auth] createSession completed in ${Date.now() - sessionStart}ms`);

      const dbUser = await this.authService.getUserById(user.userId);
      const profileComplete = this.authService.isProfileComplete(dbUser);
      this.logger.log(
        `[Auth] Supabase login success: userId=${user.userId} email=${user.email} total=${Date.now() - loginStart}ms`,
      );
      return {
        session_token: sessionToken,
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        userId: user.userId,
        email: user.email,
        name: user.name,
        firstName: dbUser?.firstName ?? firstName,
        lastName: dbUser?.lastName ?? lastName,
        role: user.role,
        profileComplete,
      };
    }

    this.logger.log(`[Auth] Login attempt via dev fallback (DB) for email: ${emailStr}`);
    const user = await this.authService.findByEmail(emailStr);
    if (!user) {
      this.logger.warn(`[Auth] Dev login failed: user not found for ${emailStr}`);
      return { error: 'User not found. Run: cd backend && npx prisma db seed' };
    }
    const sessionToken = await this.authService.createSession(user);
    const dbUser = await this.authService.getUserById(user.userId);
    const profileComplete = this.authService.isProfileComplete(dbUser);
    this.logger.log(`[Auth] Dev login success: userId=${user.userId} email=${user.email}`);
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
  @Post('recover')
  async recover(@Body('email') email: string): Promise<{ error?: string }> {
    const emailStr = (email || '').trim();
    if (!emailStr) return { error: 'Email is required.' };

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
      this.logger.warn(`[Auth] Recover error for ${emailStr} after ${Date.now() - recoverStart}ms:`, err);
      return { error: msg };
    }
    this.logger.log(`[Auth] Supabase recover fetch completed in ${Date.now() - recoverStart}ms`);
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      const msg = data?.msg || data?.error_description || 'Password reset failed.';
      this.logger.warn(`[Auth] Recover failed for ${emailStr}: ${msg}`);
      return { error: msg };
    }

    this.logger.log(`[Auth] Recover email sent to ${emailStr}`);
    return {};
  }

  /**
   * GET /api/auth/chatbot-token
   * Returns GoTrue JWT for chatbot (unlimited queries). Requires session auth.
   */
  @Get('chatbot-token')
  @UseGuards(JwtAuthGuard)
  async getChatbotToken(@CurrentUser() user: AuthUser, @Req() req: Request) {
    const raw =
      req.headers['x-session-token'] ??
      (req.headers.authorization?.startsWith?.('Bearer ')
        ? req.headers.authorization.slice(7).trim()
        : null);
    const sessionToken = Array.isArray(raw) ? raw[0] : raw;
    if (!sessionToken || typeof sessionToken !== 'string') return { token: null };
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
  async getMe(@CurrentUser() user: AuthUser) {
    const dbUser = await this.authService.getUserById(user.userId);
    const nameParts = (user.name ?? '').trim().split(/\s+/).filter(Boolean);
    const dbFirst = dbUser?.firstName?.trim();
    const dbLast = dbUser?.lastName?.trim();
    const firstName =
      dbFirst && dbFirst !== 'User' ? dbFirst : nameParts[0] || dbFirst || 'User';
    const lastName = dbLast ? dbLast : nameParts.slice(1).join(' ') || dbLast || '';
    const profileComplete = this.authService.isProfileComplete(dbUser);
    this.logger.debug(`[Auth] /me OK: userId=${user.userId} email=${user.email}`);
    return {
      userId: user.userId,
      authId: user.authId,
      email: user.email,
      name: user.name,
      firstName,
      lastName,
      role: user.role,
      profileComplete,
    };
  }
}
