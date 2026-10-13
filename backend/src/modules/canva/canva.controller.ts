import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpException,
  Param,
  Post,
  Query,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { UserRole } from '@prisma/client';
import type { Response } from 'express';
import { memoryStorage } from 'multer';
import { CurrentUser } from '../../auth/current-user.decorator';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { Roles } from '../../auth/roles.decorator';
import { RolesGuard } from '../../auth/roles.guard';
import type { AuthUser } from '../../auth/auth.service';
import { CanvaService, PPTX_MIME } from './canva.service';

/** A slide deck with every slide as artwork stays well under this. */
const MAX_FILE_BYTES = 80 * 1024 * 1024;

@Controller('admin/canva')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class CanvaController {
  constructor(private readonly canva: CanvaService) {}

  @Get('status')
  status(@CurrentUser() admin: AuthUser) {
    return this.canva.status(admin.userId);
  }

  @Get('connect')
  async connect(@CurrentUser() admin: AuthUser) {
    return { url: await this.canva.authorizeUrl(admin.userId) };
  }

  @Post('imports')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: MAX_FILE_BYTES, files: 1 },
    }),
  )
  async startImport(
    @CurrentUser() admin: AuthUser,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body('title') title?: string,
  ) {
    if (!file?.buffer?.length) {
      throw new BadRequestException('Attach the file to send to Canva.');
    }
    const jobId = await this.canva.startImport(
      admin.userId,
      file.buffer,
      typeof title === 'string' ? title : '',
      file.mimetype && file.mimetype !== 'application/octet-stream'
        ? file.mimetype
        : PPTX_MIME,
    );
    return { jobId };
  }

  @Get('imports/:jobId')
  importJob(@CurrentUser() admin: AuthUser, @Param('jobId') jobId: string) {
    return this.canva.importJob(admin.userId, jobId);
  }
}

const esc = (s: string) =>
  s.replace(
    /[&<>"]/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] ?? c,
  );

function page(ok: boolean, message: string): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${ok ? 'Canva connected' : 'Canva not connected'}</title></head>
<body style="margin:0;min-height:100vh;display:grid;place-items:center;background:#F2F4F8;color:#22303C;font:16px/1.5 system-ui,-apple-system,sans-serif">
<main style="max-width:420px;padding:32px;text-align:center"><h1 style="font-size:20px;margin:0 0 8px">${ok ? 'Canva is connected' : 'Canva is not connected'}</h1><p style="margin:0;color:#465565">${esc(message)}</p></main></body></html>`;
}

/**
 * Canva's OAuth redirect. Public on purpose: the browser arrives from Canva
 * without the platform's auth header, and the one-time state ties the visit
 * to the admin who started it.
 */
@Controller('canva')
export class CanvaCallbackController {
  constructor(private readonly canva: CanvaService) {}

  @Get('callback')
  async callback(
    @Res() res: Response,
    @Query('code') code?: string,
    @Query('state') state?: string,
    @Query('error') error?: string,
  ) {
    if (error) {
      res
        .status(400)
        .type('html')
        .send(
          page(
            false,
            'Canva access was not allowed. Close this tab and try again.',
          ),
        );
      return;
    }
    try {
      await this.canva.completeAuthorization(code, state);
      res
        .status(200)
        .type('html')
        .send(
          page(
            true,
            'Your design opens here in a moment. You can also close this tab.',
          ),
        );
    } catch (e) {
      const message =
        e instanceof HttpException
          ? e.message
          : "Couldn't finish connecting to Canva. Close this tab and try again.";
      res
        .status(e instanceof HttpException ? e.getStatus() : 500)
        .type('html')
        .send(page(false, message));
    }
  }
}
