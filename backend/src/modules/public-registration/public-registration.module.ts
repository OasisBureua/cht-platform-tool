import { Module } from '@nestjs/common';
import { AuthModule } from '../../auth/auth.module';
import { EmailModule } from '../email/email.module';
import { PublicRegistrationController } from './public-registration.controller';
import { PublicRegistrationService } from './public-registration.service';

@Module({
  imports: [AuthModule, EmailModule],
  controllers: [PublicRegistrationController],
  providers: [PublicRegistrationService],
})
export class PublicRegistrationModule {}
