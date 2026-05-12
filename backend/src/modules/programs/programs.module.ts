import { Module } from '@nestjs/common';
import { AuthModule } from '../../auth/auth.module';
import { EmailModule } from '../email/email.module';
import { HubSpotModule } from '../hubspot/hubspot.module';
import { PaymentsModule } from '../payments/payments.module';
import { OptionalJwtAuthGuard } from '../../auth/optional-jwt-auth.guard';
import { ProgramsController } from './programs.controller';
import { ProgramsService } from './programs.service';
import { ProgramRegistrationsService } from './program-registrations.service';
import { FormJotformProgressService } from './form-jotform-progress.service';

@Module({
  imports: [AuthModule, EmailModule, HubSpotModule, PaymentsModule],
  controllers: [ProgramsController],
  providers: [
    ProgramsService,
    ProgramRegistrationsService,
    FormJotformProgressService,
    OptionalJwtAuthGuard,
  ],
  exports: [
    ProgramsService,
    ProgramRegistrationsService,
    FormJotformProgressService,
  ],
})
export class ProgramsModule {}
