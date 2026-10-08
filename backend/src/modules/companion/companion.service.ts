import {
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import type { Request, Response } from 'express';
import { once } from 'node:events';
import type { AuthUser } from '../../auth/auth.service';
import { PrismaService } from '../../prisma/prisma.service';
import type { ChatRequestDto } from './dto/chat-request.dto';
import { SseAccumulator } from './sse-accumulator';

const HISTORY_TURNS = 20;
/** Companion `HistoryTurn.content` limit; long answers can exceed it. */
const HISTORY_CONTENT_MAX = 8192;
const TITLE_MAX = 80;
const CONVERSATION_LIST_LIMIT = 50;

export function conversationTitle(query: string): string {
  const collapsed = query.replace(/\s+/g, ' ').trim();
  if (collapsed.length <= TITLE_MAX) return collapsed || 'New chat';
  return `${collapsed.slice(0, TITLE_MAX - 1).trimEnd()}…`;
}

@Injectable()
export class CompanionService {
  private readonly logger = new Logger(CompanionService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Authenticated SSE proxy to companion POST /chat.
   * History comes from the database (never the request body). The stream is
   * forwarded as it arrives; the assistant turn is saved once it ends.
   */
  async proxyChat(
    dto: ChatRequestDto,
    user: AuthUser,
    requestId: string,
    req: Request,
    res: Response,
  ): Promise<void> {
    const baseUrl = this.config.get<string>('companion.baseUrl')?.trim() || '';
    const secret =
      this.config.get<string>('companion.internalSecret')?.trim() || '';

    if (!baseUrl) {
      res.status(HttpStatus.SERVICE_UNAVAILABLE).json({
        error: {
          code: 'internal',
          message: 'Companion is not configured.',
          field: null,
          retry_after_ms: null,
        },
      });
      return;
    }

    let conversationId: string;
    if (dto.conversation_id) {
      const existing = await this.prisma.companionConversation.findFirst({
        where: { id: dto.conversation_id, userId: user.userId },
        select: { id: true },
      });
      if (!existing) {
        res.status(HttpStatus.NOT_FOUND).json({
          error: {
            code: 'not_found',
            message: 'Conversation not found.',
            field: 'conversation_id',
            retry_after_ms: null,
          },
        });
        return;
      }
      conversationId = existing.id;
    } else {
      const created = await this.prisma.companionConversation.create({
        data: { userId: user.userId, title: conversationTitle(dto.query) },
        select: { id: true },
      });
      conversationId = created.id;
    }

    const history = await this.loadHistory(conversationId);

    await this.prisma.companionMessage.create({
      data: { conversationId, role: 'user', content: dto.query },
    });

    const abort = new AbortController();
    const onClose = () => {
      if (!abort.signal.aborted) abort.abort();
    };
    req.on('close', onClose);

    const acc = new SseAccumulator();
    let streamStarted = false;

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
        'X-User-Id': user.userId,
        'X-User-Role':
          String(user.role || '').toUpperCase() === 'ADMIN'
            ? 'admin'
            : 'member',
        'X-Request-Id': requestId,
        'X-Client': 'web',
      };
      if (secret) {
        headers['X-BFF-Auth'] = secret;
      }

      const upstream = await fetch(`${baseUrl}/chat`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          query: dto.query,
          conversation_id: conversationId,
          history,
          options: dto.options,
        }),
        signal: abort.signal,
      });

      if (!upstream.ok || !upstream.body) {
        let payload: unknown;
        try {
          payload = await upstream.json();
        } catch {
          payload = {
            error: {
              code: 'internal',
              message: 'Companion request failed.',
              field: null,
              retry_after_ms: null,
            },
          };
        }
        res.status(upstream.status).json(payload);
        return;
      }

      const upstreamRequestId =
        upstream.headers.get('X-Request-Id') ||
        upstream.headers.get('x-request-id') ||
        requestId;

      res.status(200);
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no');
      res.setHeader('X-Request-Id', upstreamRequestId);
      res.setHeader('X-Conversation-Id', conversationId);
      if (typeof res.flushHeaders === 'function') {
        res.flushHeaders();
      }
      streamStarted = true;

      res.write(
        `event: conversation\ndata: ${JSON.stringify({ conversation_id: conversationId })}\n\n`,
      );

      const reader = upstream.body.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        acc.push(value);
        if (!res.write(value)) {
          await once(res, 'drain', { signal: abort.signal });
        }
      }
      acc.end();
      res.end();
    } catch (err: unknown) {
      if (abort.signal.aborted) {
        return;
      }
      this.logger.warn({ err, requestId }, 'Companion upstream proxy failed');
      if (!res.headersSent) {
        res.status(503).json({
          error: {
            code: 'internal',
            message: 'Companion unavailable.',
            field: null,
            retry_after_ms: null,
          },
        });
        return;
      }
      if (!res.writableEnded) {
        res.end();
      }
    } finally {
      req.off('close', onClose);
      if (streamStarted) {
        acc.end();
        await this.saveAssistantTurn(
          conversationId,
          acc,
          abort.signal.aborted,
          requestId,
        );
      }
    }
  }

  async listConversations(userId: string) {
    return this.prisma.companionConversation.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      take: CONVERSATION_LIST_LIMIT,
      select: { id: true, title: true, createdAt: true, updatedAt: true },
    });
  }

  async getConversation(userId: string, id: string) {
    const conversation = await this.prisma.companionConversation.findFirst({
      where: { id, userId },
      select: {
        id: true,
        title: true,
        createdAt: true,
        updatedAt: true,
        messages: {
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            role: true,
            content: true,
            citations: true,
            finishReason: true,
            createdAt: true,
          },
        },
      },
    });
    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }
    return conversation;
  }

  async deleteConversation(userId: string, id: string): Promise<void> {
    const { count } = await this.prisma.companionConversation.deleteMany({
      where: { id, userId },
    });
    if (count === 0) {
      throw new NotFoundException('Conversation not found');
    }
  }

  private async loadHistory(
    conversationId: string,
  ): Promise<{ role: 'user' | 'assistant'; content: string }[]> {
    const rows = await this.prisma.companionMessage.findMany({
      where: { conversationId, content: { not: '' } },
      orderBy: { createdAt: 'desc' },
      take: HISTORY_TURNS,
      select: { role: true, content: true },
    });
    return rows.reverse().map((m) => ({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: m.content.slice(0, HISTORY_CONTENT_MAX),
    }));
  }

  private async saveAssistantTurn(
    conversationId: string,
    acc: SseAccumulator,
    cancelled: boolean,
    requestId: string,
  ): Promise<void> {
    try {
      const content = acc.content;
      if (content.trim()) {
        await this.prisma.companionMessage.create({
          data: {
            conversationId,
            role: 'assistant',
            content,
            citations: acc.citations.length
              ? (acc.citations as Prisma.InputJsonValue)
              : undefined,
            finishReason:
              acc.finishReason ?? (cancelled ? 'cancelled' : 'error'),
          },
        });
      }
      await this.prisma.companionConversation.update({
        where: { id: conversationId },
        data: { updatedAt: new Date() },
      });
    } catch (err: unknown) {
      this.logger.warn(
        { err, requestId, conversationId },
        'Failed to save Companion assistant turn',
      );
    }
  }
}
