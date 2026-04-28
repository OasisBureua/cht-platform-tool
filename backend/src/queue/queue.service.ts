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

    // Map queue names to URLs (payment only for now)
    this.queueUrls = new Map([
      ['PAYMENT_QUEUE', this.configService.get<string>('sqs.paymentQueueUrl') || ''],
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
   * Enqueue payment job. @returns true if SQS accepted the message, false if queueURL missing (local dev) or send failed.
   */
  async processPayment(
    userId: string,
    amount: number,
    paymentType: string,
    programId: string | undefined,
    idempotencyKey: string,
  ): Promise<boolean> {
    const queueUrl = this.queueUrls.get('PAYMENT_QUEUE');

    if (!queueUrl || !this.sqsClient) {
      this.logger.warn('Queue not configured: PAYMENT_QUEUE');
      this.logger.debug(
        `Would send message: ${JSON.stringify({
          type: 'PROCESS_PAYMENT',
          userId,
          amount,
          paymentType,
          programId,
          idempotencyKey,
        })}`,
      );
      return false;
    }

    try {
      const command = new SendMessageCommand({
        QueueUrl: queueUrl,
        MessageBody: JSON.stringify({
          type: 'PROCESS_PAYMENT',
          userId,
          amount,
          paymentType,
          programId,
          idempotencyKey,
          timestamp: new Date().toISOString(),
        }),
      });

      const response = await this.sqsClient.send(command);
      this.logger.log(`Message sent to PAYMENT_QUEUE: ${response.MessageId}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to send message to PAYMENT_QUEUE`, error);
      return false;
    }
  }
}
