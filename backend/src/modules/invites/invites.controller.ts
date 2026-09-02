import { Controller, Get, Param, Post } from '@nestjs/common';
import { InvitesService } from './invites.service';

/**
 * SCRUM-175: public endpoints backing the invite-token flow.
 *
 * The invite URL sent to unregistered emails looks like
 * `https://.../join?invite=<token>`. The frontend Join page hits
 * GET /api/invites/:token to resolve the token to `{ email, programIds }` so
 * it can pre-fill the signup form. After successful signup, the frontend
 * calls POST /api/invites/:token/consume to mark the token used.
 *
 * Both routes are public (no JWT) and rate-limited by the app-wide throttler.
 */
@Controller('invites')
export class InvitesController {
  constructor(private readonly invitesService: InvitesService) {}

  @Get(':token')
  async resolve(
    @Param('token') token: string,
  ): Promise<{ email: string; programIds: string[] }> {
    return this.invitesService.resolveInvite(token);
  }

  @Post(':token/consume')
  async consume(@Param('token') token: string): Promise<{ ok: true }> {
    await this.invitesService.consumeInvite(token);
    return { ok: true };
  }
}
