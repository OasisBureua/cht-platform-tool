import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class QueueService {
  private redis: Redis;

  constructor(private configService: ConfigService) {
    this.redis = new Redis({
      host: this.configService.get('REDIS_HOST', 'localhost'),
      port: this.configService.get('REDIS_PORT', 6379),
      db: this.configService.get('REDIS_DB', 0),
    });
  }

  /**
   * Queue a Celery task
   */
  async queueTask(taskName: string, args: any[] = [], kwargs: any = {}) {
    const taskId = this.generateTaskId();
    
    // Celery message format
    const message = {
      body: Buffer.from(JSON.stringify([args, kwargs, {}])).toString('base64'),
      headers: {
        lang: 'js',
        task: taskName,
        id: taskId,
        root_id: taskId,
        parent_id: null,
        group: null,
        retries: 0,
        eta: null,
        expires: null,
      },
      'content-type': 'application/json',
      'content-encoding': 'utf-8',
      properties: {
        correlation_id: taskId,
        delivery_mode: 2,
        delivery_tag: taskId,
        body_encoding: 'base64',
        delivery_info: {
          exchange: '',
          routing_key: 'celery',
        },
      },
    };

    // Push to Redis list
    await this.redis.lpush('celery', JSON.stringify(message));

    return { taskId, taskName };
  }

  // Email jobs
  async sendWelcomeEmail(userEmail: string, userName: string) {
    return this.queueTask('send_welcome_email', [userEmail, userName]);
  }

  async sendEnrollmentConfirmation(userEmail: string, programTitle: string) {
    return this.queueTask('send_enrollment_confirmation', [userEmail, programTitle]);
  }

  async sendCMECertificateEmail(userEmail: string, certificateUrl: string) {
    return this.queueTask('send_cme_certificate_email', [userEmail, certificateUrl]);
  }

  // Payment jobs
  async processPayment(paymentId: string, amount: number, userId: string) {
    return this.queueTask('process_payment', [paymentId, amount, userId]);
  }

  async processHonorarium(userId: string, amount: number, programId: string) {
    return this.queueTask('process_honorarium', [userId, amount, programId]);
  }

  // CME jobs
  async generateCMECertificate(userId: string, programId: string, credits: number) {
    return this.queueTask('generate_cme_certificate', [userId, programId, credits]);
  }

  // Helper method
  private generateTaskId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
  }
}
