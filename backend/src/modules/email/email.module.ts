import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { SesEmailService } from './ses-email.service';
import { OutboundEmailLogService } from './outbound-email-log.service';

@Module({
  imports: [PrismaModule],
  providers: [SesEmailService, OutboundEmailLogService],
  exports: [SesEmailService, OutboundEmailLogService],
})
export class EmailModule {}
