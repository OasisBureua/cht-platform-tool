import { Global, Module } from '@nestjs/common';
import { QueueService } from './queue.service';

@Global() // Makes queue service available everywhere
@Module({
  providers: [QueueService],
  exports: [QueueService],
})
export class QueueModule {}
