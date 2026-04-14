import { Module } from '@nestjs/common';
import { AuthModule } from '../../auth/auth.module';
import { HubSpotModule } from '../hubspot/hubspot.module';
import { ProgramsController } from './programs.controller';
import { ProgramsService } from './programs.service';
import { ProgramRegistrationsService } from './program-registrations.service';

@Module({
  imports: [AuthModule, HubSpotModule],
  controllers: [ProgramsController],
  providers: [ProgramsService, ProgramRegistrationsService],
  exports: [ProgramsService, ProgramRegistrationsService],
})
export class ProgramsModule {}
