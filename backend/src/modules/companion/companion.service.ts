import {
  HttpStatus,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import type { AuthUser } from '../../auth/auth.service';
import type { ChatRequestDto } from './dto/chat-request.dto';

@Injectable()
export class CompanionService {
  private readonly logger = new Logger(CompanionService.name);

  constructor(private readonly config: ConfigService) {}

  /**
   * Authenticated SSE proxy to companion POST /chat.
   * Does not buffer the upstream body; aborts when the browser disconnects.
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

    const abort = new AbortController();
    const onClose = () => {
      if (!abort.signal.aborted) abort.abort();
    };
    req.on('close', onClose);

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
        'X-User-Id': user.userId,
        'X-User-Role':
          String(user.role || '').toUpperCase() === 'ADMIN' ? 'admin' : 'member',
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
          conversation_id: dto.conversation_id ?? null,
          history: dto.history ?? [],
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
      if (typeof res.flushHeaders === 'function') {
        res.flushHeaders();
      }

      const nodeReadable = Readable.fromWeb(
        upstream.body as import('node:stream/web').ReadableStream,
      );
      await pipeline(nodeReadable, res);
    } catch (err) {
      if (abort.signal.aborted) {
        return;
      }
      this.logger.warn(
        { err, requestId },
        'Companion upstream proxy failed',
      );
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
    }
  }
}
