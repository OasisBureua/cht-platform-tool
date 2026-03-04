import { Module } from '@nestjs/common';
import { AuthModule } from '../../auth/auth.module';
import { QueueModule } from '../../queue/queue.module';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { BillService } from './bill.service';

@Module({
  imports: [AuthModule, QueueModule],
  controllers: [PaymentsController],
  providers: [PaymentsService, BillService],
  exports: [PaymentsService, BillService],
})
export class PaymentsModule {}
