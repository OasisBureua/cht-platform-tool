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

      const user = await this.authService.findOrCreateByAuthId(
        authId,
        data.user?.email,
        data.user?.user_metadata?.first_name || data.user?.user_metadata?.full_name,
        data.user?.user_metadata?.last_name,
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
