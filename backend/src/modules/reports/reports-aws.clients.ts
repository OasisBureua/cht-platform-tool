import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { S3Client } from '@aws-sdk/client-s3';
import { SQSClient } from '@aws-sdk/client-sqs';

/** Explicit credentials when set (local dev), else the default chain (ECS task role). */
@Injectable()
export class ReportsAwsClients {
  readonly dynamodb: DynamoDBDocumentClient;
  readonly sqs: SQSClient;
  readonly s3: S3Client;

  constructor(config: ConfigService) {
    const region = config.get<string>('aws.region') || 'us-east-1';
    const accessKeyId = config.get<string>('aws.accessKeyId');
    const secretAccessKey = config.get<string>('aws.secretAccessKey');
    const base = {
      region,
      ...(accessKeyId && secretAccessKey
        ? { credentials: { accessKeyId, secretAccessKey } }
        : {}),
    };

    this.dynamodb = DynamoDBDocumentClient.from(new DynamoDBClient(base), {
      marshallOptions: { removeUndefinedValues: true },
    });
    this.sqs = new SQSClient(base);
    this.s3 = new S3Client(base);
  }
}
