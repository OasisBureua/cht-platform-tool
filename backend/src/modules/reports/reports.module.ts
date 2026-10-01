import { Module } from '@nestjs/common';
import { AuthModule } from '../../auth/auth.module';
import { CampaignLinksController } from './campaign-links.controller';
import { ReportRecipientsService } from './report-recipients.service';
import { ReportsAwsClients } from './reports-aws.clients';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';

@Module({
  imports: [AuthModule],
  controllers: [ReportsController, CampaignLinksController],
  providers: [ReportsAwsClients, ReportRecipientsService, ReportsService],
})
export class ReportsModule {}
