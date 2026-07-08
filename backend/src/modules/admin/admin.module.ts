import { Module } from '@nestjs/common';
import { AuthModule } from '../../auth/auth.module';
import { PrismaModule } from '../../prisma/prisma.module';
import { AdminController } from './admin.controller';
import { ProgramsModule } from '../programs/programs.module';
import { SurveysModule } from '../surveys/surveys.module';
import { WebinarsModule } from '../webinars/webinars.module';
import { SessionHeroPresignService } from './session-hero-presign.service';
import { AdminAuditInterceptor } from './admin-audit.interceptor';

@Module({
  imports: [
    AuthModule,
    PrismaModule,
    ProgramsModule,
    SurveysModule,
    WebinarsModule,
  ],
  controllers: [AdminController],
  providers: [SessionHeroPresignService, AdminAuditInterceptor],
})
export class AdminModule {}
