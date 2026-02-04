import { Module } from '@nestjs/common';
import { AuthModule } from '../../auth/auth.module';
import { AdminController } from './admin.controller';
import { ProgramsModule } from '../programs/programs.module';
import { SurveysModule } from '../surveys/surveys.module';

@Module({
  imports: [AuthModule, ProgramsModule, SurveysModule],
  controllers: [AdminController],
})
export class AdminModule {}
