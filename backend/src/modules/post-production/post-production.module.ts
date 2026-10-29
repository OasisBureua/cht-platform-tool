import { Module } from '@nestjs/common';
import { AuthModule } from '../../auth/auth.module';
import { PrismaModule } from '../../prisma/prisma.module';
import { ZoomRecordingsModule } from '../zoom-recordings/zoom-recordings.module';
import { AdminPostProductionController } from './admin-post-production.controller';
import { PostProductionLookService } from './post-production-look.service';
import { PostProductionTranscriptsService } from './post-production-transcripts.service';

/** Admin › Post-production: transcripts from audio, AI looks and client error logs for the clipper. */
@Module({
  imports: [AuthModule, PrismaModule, ZoomRecordingsModule],
  controllers: [AdminPostProductionController],
  providers: [PostProductionTranscriptsService, PostProductionLookService],
})
export class PostProductionModule {}
