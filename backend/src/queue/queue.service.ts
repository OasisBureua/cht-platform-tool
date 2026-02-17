import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';

@Injectable()
export class QueueService {
  private readonly logger = new Logger(QueueService.name);
  private sqsClient: SQSClient;
  private queueUrls: Map<string, string>;

  constructor(private configService: ConfigService) {
    // Initialize SQS client - use explicit credentials when set (local dev), else default chain (ECS task role)
    const region = this.configService.get<string>('aws.region') || 'us-east-1';
    const accessKeyId = this.configService.get<string>('aws.accessKeyId');
    const secretAccessKey = this.configService.get<string>('aws.secretAccessKey');

    this.sqsClient = new SQSClient({
      region,
      ...(accessKeyId && secretAccessKey
        ? { credentials: { accessKeyId, secretAccessKey } }
        : {}),
    });
    if (accessKeyId && secretAccessKey) {
      this.logger.log('SQS client initialized (explicit credentials)');
    } else {
      this.logger.log('SQS client initialized (default credential chain)');
    }

    // Map queue names to URLs
    this.queueUrls = new Map([
      ['EMAIL_QUEUE', this.configService.get<string>('sqs.emailQueueUrl') || ''],
      ['PAYMENT_QUEUE', this.configService.get<string>('sqs.paymentQueueUrl') || ''],
      ['CME_QUEUE', this.configService.get<string>('sqs.cmeQueueUrl') || ''],
    ]);
  }

  /**
   * Send message to SQS queue
   */
  async sendMessage(queueName: string, messageBody: any): Promise<void> {
    const queueUrl = this.queueUrls.get(queueName);

    if (!queueUrl || !this.sqsClient) {
      this.logger.warn(`Queue not configured: ${queueName}`);
      this.logger.debug(`Would send message: ${JSON.stringify(messageBody)}`);
      return; // Skip in local development
    }

    try {
      const command = new SendMessageCommand({
        QueueUrl: queueUrl,
        MessageBody: JSON.stringify(messageBody),
      });

      const response = await this.sqsClient.send(command);
      this.logger.log(`Message sent to ${queueName}: ${response.MessageId}`);
    } catch (error) {
      this.logger.error(
        `Failed to send message to ${queueName} - business operation will succeed but job may need retry:`,
        error,
      );
      // Do not rethrow - allow survey/program completion to succeed; queue can be retried manually or via DLQ
    }
  }

  /**
   * Send email job to queue
   */
  async sendEmail(to: string, subject: string, body: string): Promise<void> {
    await this.sendMessage('EMAIL_QUEUE', {
      type: 'SEND_EMAIL',
      to,
      subject,
      body,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Process payment job
   */
  async processPayment(
    userId: string,
    amount: number,
    type: string,
    programId?: string,
  ): Promise<void> {
    await this.sendMessage('PAYMENT_QUEUE', {
      type: 'PROCESS_PAYMENT',
      userId,
      amount,
      paymentType: type,
      programId,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Generate CME certificate job
   */
  async generateCertificate(
    userId: string,
    programId: string,
    credits: number,
  ): Promise<void> {
    await this.sendMessage('CME_QUEUE', {
      type: 'GENERATE_CERTIFICATE',
      userId,
      programId,
      credits,
      timestamp: new Date().toISOString(),
    });
  }
}
