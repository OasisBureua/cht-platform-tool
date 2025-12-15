import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { SqsService } from './queue/sqs.service';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly sqsService: SqsService,
  ) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('health')
  getHealth() {
    const queueStatus = this.sqsService.getQueueStatus();
    const allConfigured = this.sqsService.isConfigured();

    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      services: {
        api: 'healthy',
        database: 'healthy', // TODO: Add actual DB health check
        queues: {
          configured: allConfigured,
          status: queueStatus,
        },
      },
    };
  }
}
