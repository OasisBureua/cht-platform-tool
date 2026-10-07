import { Module } from '@nestjs/common';
import { AuthModule } from '../../auth/auth.module';
import { EmailModule } from '../email/email.module';
import { CampaignLinksController } from './campaign-links.controller';
import {
  InternalReportsController,
  ReportsNotifyM2mGuard,
} from './internal-reports.controller';
import { ReportReadyService } from './report-ready.service';
import { ReportRecipientsService } from './report-recipients.service';
import { ReportsAwsClients } from './reports-aws.clients';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';

@Module({
  imports: [AuthModule, EmailModule],
  controllers: [
    ReportsController,
    CampaignLinksController,
    InternalReportsController,
  ],
  providers: [
    ReportsAwsClients,
    ReportRecipientsService,
    ReportsService,
    ReportReadyService,
    ReportsNotifyM2mGuard,
  ],
})
export class ReportsModule {}
