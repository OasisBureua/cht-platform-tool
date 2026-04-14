import { Module } from '@nestjs/common';
import { AuthModule } from '../../auth/auth.module';
import { HubSpotModule } from '../hubspot/hubspot.module';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

@Module({
  imports: [AuthModule, HubSpotModule],
  controllers: [DashboardController],
  providers: [DashboardService],
  exports: [DashboardService],
})
export class DashboardModule {}