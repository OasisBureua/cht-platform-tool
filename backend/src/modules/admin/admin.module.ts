import { Module } from '@nestjs/common';
import { AuthModule } from '../../auth/auth.module';
import { PrismaModule } from '../../prisma/prisma.module';
import { AdminController } from './admin.controller';
import { ProgramsModule } from '../programs/programs.module';
import { SurveysModule } from '../surveys/surveys.module';
import { WebinarsModule } from '../webinars/webinars.module';
import { EmailModule } from '../email/email.module';
import { SessionHeroPresignService } from './session-hero-presign.service';
import { ProgramZoomRecordingsService } from './program-zoom-recordings.service';

@Module({
  imports: [
    AuthModule,
    PrismaModule,
    ProgramsModule,
    SurveysModule,
    WebinarsModule,
    EmailModule,
  ],
  controllers: [AdminController],
  providers: [SessionHeroPresignService, ProgramZoomRecordingsService],
})
export class AdminModule {}
