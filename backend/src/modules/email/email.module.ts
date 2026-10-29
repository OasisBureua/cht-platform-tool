import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { SesEmailService } from './ses-email.service';
import { OutboundEmailLogService } from './outbound-email-log.service';
import { ProgramEmailOverrideService } from './program-email-override.service';

@Module({
  imports: [PrismaModule],
  providers: [
    SesEmailService,
    OutboundEmailLogService,
    ProgramEmailOverrideService,
  ],
  exports: [
    SesEmailService,
    OutboundEmailLogService,
    ProgramEmailOverrideService,
  ],
})
export class EmailModule {}
