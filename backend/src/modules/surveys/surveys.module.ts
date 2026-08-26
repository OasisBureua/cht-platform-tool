import { Module } from '@nestjs/common';
import { AuthModule } from '../../auth/auth.module';
import { OutboundSyncModule } from '../outbound-sync/outbound-sync.module';
import { JotformModule } from '../jotform/jotform.module';
import { ProgramsModule } from '../programs/programs.module';
import { SurveysController } from './surveys.controller';
import { SurveysService } from './surveys.service';

@Module({
  imports: [AuthModule, OutboundSyncModule, JotformModule, ProgramsModule],
  controllers: [SurveysController],
  providers: [SurveysService],
  exports: [SurveysService],
})
export class SurveysModule {}
