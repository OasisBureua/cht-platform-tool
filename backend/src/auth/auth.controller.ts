import { Controller, Get, Post, Body, UseGuards, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtAuthGuard } from './jwt-auth.guard';
import { CurrentUser } from './current-user.decorator';
import { AuthUser, AuthService } from './auth.service';

interface LoginSuccess {
  session_token: string;
  access_token?: string;
  refresh_token?: string;
  userId: string;
  email: string;
  name: string;
  role: string;
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
  ): Promise<{ error?: string }> {
    const emailStr = (email || '').trim();
    if (!emailStr) return { error: 'Email is required.' };
    if (!password) return { error: 'Password is required.' };
    if (password.length < 8) return { error: 'Password must be at least 8 characters.' };

    const npi = (npiNumber || '').replace(/\D/g, '');
    if (npi.length !== 10) return { error: 'NPI number must be 10 digits.' };

    const supabaseUrl = this.configService.get<string>('supabase.url');
    const supabaseAnon = this.configService.get<string>('supabase.anonKey');

    if (!supabaseUrl || !supabaseAnon) {
      return { error: 'Sign up is not configured. Contact support.' };
    }

    this.logger.log(`[Auth] Signup attempt for email: ${emailStr}`);
    const res = await fetch(`${supabaseUrl.replace(/\/$/, '')}/auth/v1/signup`, {
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
        },
      }),
    });
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
    if (!emailStr) {
      return { error: 'Email is required.' };
    }

    const supabaseUrl = this.configService.get<string>('supabase.url');
    const supabaseAnon = this.configService.get<string>('supabase.anonKey');

    if (supabaseUrl && supabaseAnon) {
      this.logger.log(`[Auth] Login attempt via Supabase for email: ${emailStr}`);
      const res = await fetch(`${supabaseUrl.replace(/\/$/, '')}/auth/v1/token?grant_type=password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: supabaseAnon,
        },
        body: JSON.stringify({ email: emailStr, password: password || '' }),
      });
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

      const user = await this.authService.findOrCreateByAuthId(
        authId,
        data.user?.email,
        firstName,
        lastName,
        npiNumber,
      );
      if (!user) return { error: 'User not found.' };

      const sessionToken = await this.authService.createSession(user);
      this.logger.log(`[Auth] Supabase login success: userId=${user.userId} email=${user.email}`);
      return {
        session_token: sessionToken,
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        userId: user.userId,
        email: user.email,
        name: user.name,
        role: user.role,
      };
    }

    this.logger.log(`[Auth] Login attempt via dev fallback (DB) for email: ${emailStr}`);
    const user = await this.authService.findByEmail(emailStr);
    if (!user) {
      this.logger.warn(`[Auth] Dev login failed: user not found for ${emailStr}`);
      return { error: 'User not found. Run: cd backend && npx prisma db seed' };
    }
    const sessionToken = await this.authService.createSession(user);
    this.logger.log(`[Auth] Dev login success: userId=${user.userId} email=${user.email}`);
    return {
      session_token: sessionToken,
      userId: user.userId,
      email: user.email,
      name: user.name,
      role: user.role,
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

    this.logger.log(`[Auth] Password reset request for: ${emailStr}`);
    const res = await fetch(`${supabaseUrl.replace(/\/$/, '')}/auth/v1/recover`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: supabaseAnon,
      },
      body: JSON.stringify({ email: emailStr }),
    });
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
   * GET /api/auth/me
   * Returns the current authenticated user's profile (userId, email, role).
   * Frontend uses this to get the DB userId for API calls.
   */
  @Get('me')
  @UseGuards(JwtAuthGuard)
  getMe(@CurrentUser() user: AuthUser) {
    this.logger.debug(`[Auth] /me OK: userId=${user.userId} email=${user.email}`);
    return {
      userId: user.userId,
      authId: user.authId,
      email: user.email,
      name: user.name,
      role: user.role,
    };
  }
}
