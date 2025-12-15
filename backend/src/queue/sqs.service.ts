import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';

export interface QueueMessage {
  jobType: string;
  payload: Record<string, any>;
  metadata?: {
    userId?: string;
    programId?: string;
    timestamp?: string;
    source?: string;
  };
}

@Injectable()
export class SqsService {
  private readonly logger = new Logger(SqsService.name);
  private readonly sqsClient: SQSClient;
  private readonly queueUrls: Record<string, string>;

  constructor(private configService: ConfigService) {
    // Initialize SQS client
    this.sqsClient = new SQSClient({
      region: this.configService.get('AWS_REGION') || 'us-east-1',
    });

    // Get queue URLs from environment
    this.queueUrls = {
      email: this.configService.get('SQS_EMAIL_QUEUE_URL') || '',
      payment: this.configService.get('SQS_PAYMENT_QUEUE_URL') || '',
      cme: this.configService.get('SQS_CME_QUEUE_URL') || '',
    };

    this.logger.log('SQS Service initialized');
    this.logger.debug(`Queue URLs configured: ${Object.keys(this.queueUrls).join(', ')}`);
  }

  /**
   * Send message to SQS queue
   */
  async sendMessage(
    queueName: 'email' | 'payment' | 'cme',
    message: QueueMessage,
  ): Promise<string> {
    const queueUrl = this.queueUrls[queueName];

    if (!queueUrl) {
      throw new Error(`Queue URL not configured for: ${queueName}`);
    }

    try {
      const command = new SendMessageCommand({
        QueueUrl: queueUrl,
        MessageBody: JSON.stringify({
          ...message,
          metadata: {
            ...message.metadata,
            timestamp: new Date().toISOString(),
            source: 'backend-api',
          },
        }),
        MessageAttributes: {
          jobType: {
            DataType: 'String',
            StringValue: message.jobType,
          },
          queueName: {
            DataType: 'String',
            StringValue: queueName,
          },
        },
      });

      const response = await this.sqsClient.send(command);

      // MessageId is always returned by SQS, but TypeScript doesn't know that
      const messageId = response.MessageId || 'unknown';

      this.logger.log(
        `Message sent to ${queueName} queue - MessageId: ${messageId}`,
      );

      return messageId;
    } catch (error) {
      this.logger.error(
        `Failed to send message to ${queueName} queue: ${error.message}`,
        error.stack,
      );
      throw new Error(`Failed to queue ${message.jobType}: ${error.message}`);
    }
  }

  // ============================================================================
  // EMAIL JOBS
  // ============================================================================

  /**
   * Queue welcome email job
   */
  async sendWelcomeEmail(
    userEmail: string,
    userName: string,
  ): Promise<string> {
    return this.sendMessage('email', {
      jobType: 'send_welcome_email',
      payload: {
        userEmail,
        userName,
      },
    });
  }

  /**
   * Queue enrollment confirmation email
   */
  async sendEnrollmentConfirmation(
    userEmail: string,
    programTitle: string,
  ): Promise<string> {
    return this.sendMessage('email', {
      jobType: 'send_enrollment_confirmation',
      payload: {
        userEmail,
        programTitle,
      },
    });
  }

  /**
   * Queue CME certificate email
   */
  async sendCMECertificateEmail(
    userEmail: string,
    certificateUrl: string,
  ): Promise<string> {
    return this.sendMessage('email', {
      jobType: 'send_cme_certificate_email',
      payload: {
        userEmail,
        certificateUrl,
      },
    });
  }

  // ============================================================================
  // PAYMENT JOBS
  // ============================================================================

  /**
   * Queue payment processing job
   */
  async processPayment(
    paymentId: string,
    amount: number,
    userId: string,
  ): Promise<string> {
    return this.sendMessage('payment', {
      jobType: 'process_payment',
      payload: {
        paymentId,
        amount,
        userId,
      },
      metadata: {
        userId,
      },
    });
  }

  /**
   * Queue honorarium payment job
   */
  async processHonorarium(
    userId: string,
    amount: number,
    programId: string,
  ): Promise<string> {
    return this.sendMessage('payment', {
      jobType: 'process_honorarium',
      payload: {
        userId,
        amount,
        programId,
      },
      metadata: {
        userId,
        programId,
      },
    });
  }

  // ============================================================================
  // CME JOBS
  // ============================================================================

  /**
   * Queue CME certificate generation job
   */
  async generateCMECertificate(
    userId: string,
    programId: string,
    credits: number,
  ): Promise<string> {
    return this.sendMessage('cme', {
      jobType: 'generate_cme_certificate',
      payload: {
        userId,
        programId,
        credits,
      },
      metadata: {
        userId,
        programId,
      },
    });
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  /**
   * Check if SQS is properly configured
   */
  isConfigured(): boolean {
    return Object.values(this.queueUrls).every((url) => url.length > 0);
  }

  /**
   * Get queue configuration status
   */
  getQueueStatus(): Record<string, boolean> {
    return {
      email: !!this.queueUrls.email,
      payment: !!this.queueUrls.payment,
      cme: !!this.queueUrls.cme,
    };
  }
}
