import { Module } from '@nestjs/common';
import { AuthModule } from '../../auth/auth.module';
import { OutboundSyncModule } from '../outbound-sync/outbound-sync.module';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

@Module({
  imports: [AuthModule, OutboundSyncModule],
  controllers: [DashboardController],
  providers: [DashboardService],
  exports: [DashboardService],
})
export class DashboardModule {}
