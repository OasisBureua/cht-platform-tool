import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Logger,
  Param,
  Post,
  Put,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { memoryStorage } from 'multer';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RolesGuard } from '../../auth/roles.guard';
import { Roles } from '../../auth/roles.decorator';
import { CurrentUser } from '../../auth/current-user.decorator';
import { AuthUser } from '../../auth/auth.service';
import { PostProductionTranscriptsService } from './post-production-transcripts.service';
import { PostProductionLookService } from './post-production-look.service';

/** An hour of 16 kHz mono AAC is ~21 MB; leave room for long recordings. */
const MAX_AUDIO_BYTES = 250 * 1024 * 1024;

@ApiTags('Admin post-production')
@Controller('admin/post-production')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminPostProductionController {
  private readonly logger = new Logger('PostProductionClient');

  constructor(
    private readonly transcripts: PostProductionTranscriptsService,
    private readonly look: PostProductionLookService,
  ) {}

  @Get('capabilities')
  @ApiOperation({
    summary:
      'What the clipper can do here: transcripts from audio, AI looks, models',
  })
  capabilities() {
    const models = this.look.models();
    return {
      transcription: this.transcripts.enabled(),
      ai: this.look.enabled(),
      models,
      defaultModelId: models[0]?.id ?? null,
    };
  }

  @Get('transcripts')
  @ApiOperation({
    summary: 'Latest transcript made for a recording (by clipper source key)',
  })
  findTranscript(@Query('sourceKey') sourceKey: string) {
    return this.transcripts.findLatest(sourceKey);
  }

  @Get('transcripts/:id')
  @ApiOperation({ summary: 'A transcript; refreshes a running job' })
  getTranscript(@Param('id') id: string) {
    return this.transcripts.get(id);
  }

  @Post('transcripts/upload')
  @ApiOperation({
    summary: 'Transcribe an audio track pulled out of a local or Dropbox video',
  })
  @UseInterceptors(
    FileInterceptor('audio', {
      storage: memoryStorage(),
      limits: { fileSize: MAX_AUDIO_BYTES },
    }),
  )
  transcribeUpload(
    @UploadedFile() audio: Express.Multer.File | undefined,
    @Body() body: { sourceKey?: string; title?: string },
    @CurrentUser() user: AuthUser,
  ) {
    if (!audio) throw new BadRequestException('audio is required');
    if (!body?.sourceKey)
      throw new BadRequestException('sourceKey is required');
    return this.transcripts.startFromAudio({
      audio: audio.buffer,
      fileName: audio.originalname || 'audio.m4a',
      contentType: audio.mimetype,
      sourceKey: body.sourceKey,
      title: body.title || audio.originalname || 'Recording',
      userId: user?.userId,
    });
  }

  @Post('transcripts/zoom')
  @ApiOperation({
    summary: 'Transcribe a Zoom recording file already in storage',
  })
  transcribeZoom(
    @Body()
    body: {
      sessionId?: string;
      fileId?: string;
      sourceKey?: string;
      title?: string;
    },
    @CurrentUser() user: AuthUser,
  ) {
    if (!body?.sessionId || !body.fileId || !body.sourceKey) {
      throw new BadRequestException(
        'sessionId, fileId and sourceKey are required',
      );
    }
    return this.transcripts.startFromZoom({
      sessionId: body.sessionId,
      fileId: body.fileId,
      sourceKey: body.sourceKey,
      title: body.title || 'Zoom recording',
      userId: user?.userId,
    });
  }

  @Put('transcripts/:id')
  @ApiOperation({ summary: 'Save corrections to a transcript' })
  saveTranscript(@Param('id') id: string, @Body() body: { cues?: unknown }) {
    return this.transcripts.saveCorrections(id, body?.cues);
  }

  @Post('look')
  @ApiOperation({
    summary:
      'AI suggestions for a clip: stressed words, number callouts, push-ins, titles',
  })
  suggestLook(
    @Body()
    body: {
      modelId?: string;
      title?: string;
      style?: string;
      start: number;
      end: number;
      cues: unknown;
    },
  ) {
    return this.look.suggest(body);
  }

  @Post('logs')
  @HttpCode(204)
  @ApiOperation({
    summary: 'Errors from the clipper in the browser, into the backend log',
  })
  log(
    @Body()
    body: {
      level?: string;
      event?: string;
      message?: string;
      context?: Record<string, unknown>;
    },
    @CurrentUser() user: AuthUser,
  ) {
    const entry = JSON.stringify({
      event: String(body?.event ?? 'unknown').slice(0, 80),
      message: String(body?.message ?? '').slice(0, 2000),
      user: user?.userId,
      context: JSON.stringify(body?.context ?? {}).slice(0, 4000),
    });
    if (body?.level === 'info') this.logger.log(entry);
    else if (body?.level === 'warn') this.logger.warn(entry);
    else this.logger.error(entry);
  }
}
