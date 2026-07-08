import { Module } from '@nestjs/common';
import { AuthModule } from '../../auth/auth.module';
import { HubSpotModule } from '../hubspot/hubspot.module';
import { JotformModule } from '../jotform/jotform.module';
import { ProgramsModule } from '../programs/programs.module';
import { SurveysController } from './surveys.controller';
import { SurveysService } from './surveys.service';

@Module({
  imports: [AuthModule, HubSpotModule, JotformModule, ProgramsModule],
  controllers: [SurveysController],
  providers: [SurveysService],
  exports: [SurveysService],
})
export class SurveysModule {}
