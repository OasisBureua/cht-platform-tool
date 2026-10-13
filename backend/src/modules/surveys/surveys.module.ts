import { Module } from '@nestjs/common';
import { AuthModule } from '../../auth/auth.module';
import { OutboundSyncModule } from '../outbound-sync/outbound-sync.module';
import { ProgramsModule } from '../programs/programs.module';
import { SurveysController } from './surveys.controller';
import { SurveysService } from './surveys.service';

/** CPR-5: Jotform create/attach removed from SurveysService; export keeps JotformModule separately. */
@Module({
  imports: [AuthModule, OutboundSyncModule, ProgramsModule],
  controllers: [SurveysController],
  providers: [SurveysService],
  exports: [SurveysService],
})
export class SurveysModule {}
