import { Module } from '@nestjs/common';
import { AuthModule } from '../../auth/auth.module';
import { CompanionController } from './companion.controller';
import { CompanionService } from './companion.service';

@Module({
  imports: [AuthModule],
  controllers: [CompanionController],
  providers: [CompanionService],
})
export class CompanionModule {}
