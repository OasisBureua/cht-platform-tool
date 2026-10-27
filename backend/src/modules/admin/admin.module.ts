import { Module } from '@nestjs/common';
import { AuthModule } from '../../auth/auth.module';
import { PrismaModule } from '../../prisma/prisma.module';
import { AdminController } from './admin.controller';
import { ProgramsModule } from '../programs/programs.module';
import { SurveysModule } from '../surveys/surveys.module';
import { WebinarsModule } from '../webinars/webinars.module';
import { EmailModule } from '../email/email.module';
import { InvitesModule } from '../invites/invites.module';
import { SessionHeroPresignService } from './session-hero-presign.service';
import { ProgramZoomRecordingsService } from './program-zoom-recordings.service';
import { ProgramInvitationsService } from './program-invitations.service';
import { ZoomRecordingsModule } from '../zoom-recordings/zoom-recordings.module';

@Module({
  imports: [
    AuthModule,
    PrismaModule,
    ProgramsModule,
    SurveysModule,
    WebinarsModule,
    EmailModule,
    InvitesModule,
    ZoomRecordingsModule,
  ],
  controllers: [AdminController],
  providers: [
    SessionHeroPresignService,
    ProgramZoomRecordingsService,
    ProgramInvitationsService,
  ],
})
export class AdminModule {}
