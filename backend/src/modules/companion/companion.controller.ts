import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { randomUUID } from 'node:crypto';
import type { Request, Response } from 'express';
import { CurrentUser } from '../../auth/current-user.decorator';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import type { AuthUser } from '../../auth/auth.service';
import { CompanionService } from './companion.service';
import { ChatRequestDto } from './dto/chat-request.dto';

@ApiTags('companion')
@Controller()
export class CompanionController {
  constructor(private readonly companionService: CompanionService) {}

  /**
   * POST /api/chat — Cognito/session gated SSE proxy to cht-companion.
   */
  @Post('chat')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('session-token')
  @ApiOperation({
    summary: 'Stream Companion chat (SSE)',
    description:
      'Authenticated members only. Proxies to companion POST /chat without buffering.',
  })
  async chat(
    @Body() body: ChatRequestDto,
    @CurrentUser() user: AuthUser,
    @Req() req: Request & { id?: string },
    @Res({ passthrough: false }) res: Response,
  ): Promise<void> {
    const incoming = req.headers['x-request-id'];
    const fromHeader =
      typeof incoming === 'string'
        ? incoming.trim()
        : Array.isArray(incoming)
          ? (
              incoming.find((v) => typeof v === 'string' && v.trim()) || ''
            ).trim()
          : '';
    const requestId =
      fromHeader ||
      (typeof req.id === 'string' && req.id.trim() ? req.id.trim() : '') ||
      randomUUID();

    await this.companionService.proxyChat(body, user, requestId, req, res);
  }

  @Get('chat/conversations')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('session-token')
  @ApiOperation({ summary: 'List the current user’s Companion conversations' })
  listConversations(@CurrentUser() user: AuthUser) {
    return this.companionService.listConversations(user.userId);
  }

  @Get('chat/conversations/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('session-token')
  @ApiOperation({ summary: 'Get a Companion conversation with its messages' })
  getConversation(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.companionService.getConversation(user.userId, id);
  }

  @Delete('chat/conversations/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('session-token')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a Companion conversation' })
  async deleteConversation(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
  ): Promise<void> {
    await this.companionService.deleteConversation(user.userId, id);
  }
}
