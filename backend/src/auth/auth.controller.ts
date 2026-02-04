import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from './jwt-auth.guard';
import { CurrentUser } from './current-user.decorator';
import { AuthUser } from './auth.service';

@Controller('auth')
@UseGuards(JwtAuthGuard)
export class AuthController {
  /**
   * GET /api/auth/me
   * Returns the current authenticated user's profile (userId, email, role).
   * Frontend uses this to get the DB userId for API calls.
   */
  @Get('me')
  getMe(@CurrentUser() user: AuthUser) {
    return {
      userId: user.userId,
      authId: user.authId,
      email: user.email,
      name: user.name,
      role: user.role,
    };
  }
}
