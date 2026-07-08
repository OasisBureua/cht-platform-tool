import { Module } from '@nestjs/common';
import { SesEmailService } from './ses-email.service';

@Module({
  providers: [SesEmailService],
  exports: [SesEmailService],
})
export class EmailModule {}
