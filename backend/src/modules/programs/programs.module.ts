import { Module } from '@nestjs/common';
import { AuthModule } from '../../auth/auth.module';
import { EmailModule } from '../email/email.module';
import { OutboundSyncModule } from '../outbound-sync/outbound-sync.module';
import { PaymentsModule } from '../payments/payments.module';
import { InvitesModule } from '../invites/invites.module';
import { OptionalJwtAuthGuard } from '../../auth/optional-jwt-auth.guard';
import { ProgramsController } from './programs.controller';
import { ProgramsService } from './programs.service';
import { ProgramRegistrationsService } from './program-registrations.service';
import { FormJotformProgressService } from './form-jotform-progress.service';

@Module({
  imports: [AuthModule, EmailModule, OutboundSyncModule, PaymentsModule, InvitesModule],
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
