import { Module } from '@nestjs/common';
import { AuthModule } from '../../auth/auth.module';
import { PrismaModule } from '../../prisma/prisma.module';
import { AdminController } from './admin.controller';
import { ProgramsModule } from '../programs/programs.module';
import { SurveysModule } from '../surveys/surveys.module';

@Module({
  imports: [AuthModule, PrismaModule, ProgramsModule, SurveysModule],
  controllers: [AdminController],
})
export class AdminModule {}
