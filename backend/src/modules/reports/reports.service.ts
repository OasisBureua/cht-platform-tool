import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DeleteCommand,
  GetCommand,
  QueryCommand,
  TransactWriteCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';
import { SendMessageCommand } from '@aws-sdk/client-sqs';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { randomUUID } from 'crypto';
import { Readable } from 'stream';
import { ReportsAwsClients } from './reports-aws.clients';
import { ReportRecipientsService } from './report-recipients.service';
import type { CreateReportDto } from './dto/create-report.dto';
import {
  DEFAULT_TEMPLATE_TYPE,
  LOCK_PREFIX,
  TERMINAL_STATUSES,
  type LockItem,
  type ReportItem,
  type ReportView,
} from './reports.types';

const LIST_MAX_ITEMS = 500;
const PDF_KEY_PREFIX = 'reports/';
const PDF_MAGIC = Buffer.from('%PDF-');
const ALLOWED_PDF_CONTENT_TYPES = new Set([
  'application/pdf',
  'application/octet-stream',
  'binary/octet-stream',
]);

type AwsError = {
  name?: string;
  CancellationReasons?: Array<{ Code?: string }>;
};

export type ReportDownload = {
  stream: Readable;
  filename: string;
  contentLength?: number;
};

@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly aws: ReportsAwsClients,
    private readonly recipients: ReportRecipientsService,
  ) {}

  isConfigured(): boolean {
    return !!(this.tableName() && this.queueUrl());
  }

  async create(dto: CreateReportDto, requestedBy: string): Promise<ReportView> {
    this.requireConfigured();

    const campaignId = dto.campaignId.trim();
    const templateType = dto.templateType || DEFAULT_TEMPLATE_TYPE;
    const now = new Date();
    const nowIso = now.toISOString();
    const reportId = randomUUID();
    const { windowStart, windowEnd } = freezeWindow(
      dto.windowStart,
      dto.windowEnd,
      now,
      dto.dateRangeDays,
    );
    const notifyEmails = await this.recipients.requireAdminEmails(
      dto.notifyEmails,
    );

    const report: ReportItem = {
      campaign_id: campaignId,
      report_id: reportId,
      template_type: templateType,
      sources: dto.sources ?? [],
      date_range_days: dto.dateRangeDays ?? null,
      window_start: windowStart,
      window_end: windowEnd,
      notify_emails: notifyEmails,
      status: 'queued',
      attempt_count: 0,
      edit_attempts: 0,
      last_error: null,
      requested_by: requestedBy,
      created_at: nowIso,
      updated_at: nowIso,
    };

    await this.withLockRetry(campaignId, templateType, () =>
      this.aws.dynamodb.send(
        new TransactWriteCommand({
          TransactItems: [
            this.lockPut(campaignId, templateType, reportId, now),
            {
              Put: {
                TableName: this.tableName(),
                Item: report,
                ConditionExpression: 'attribute_not_exists(report_id)',
              },
            },
          ],
        }),
      ),
    );

    try {
      await this.enqueue(reportId, campaignId);
    } catch (err) {
      this.logger.error(
        `[reports] enqueue failed reportId=${reportId} campaignId=${campaignId}: ${errMessage(err)}`,
      );
      await this.markEnqueueFailed(campaignId, reportId);
      await this.releaseLock(campaignId, templateType, reportId);
      throw new ServiceUnavailableException(
        'Could not queue report generation',
      );
    }

    this.logger.log(
      `[reports] queued reportId=${reportId} campaignId=${campaignId} template=${templateType}`,
    );
    return this.toView(report);
  }

  async get(reportId: string, campaignId?: string): Promise<ReportView> {
    this.requireConfigured();
    const report = await this.requireReport(reportId, campaignId);
    return this.toView(await this.expireIfStale(report));
  }

  async list(campaignId: string): Promise<ReportView[]> {
    this.requireConfigured();

    const items: ReportItem[] = [];
    let startKey: Record<string, unknown> | undefined;
    do {
      const page = await this.aws.dynamodb.send(
        new QueryCommand({
          TableName: this.tableName(),
          KeyConditionExpression: 'campaign_id = :c',
          ExpressionAttributeValues: { ':c': campaignId },
          ExclusiveStartKey: startKey,
        }),
      );
      // report_id is the sort key, which DynamoDB rejects in a FilterExpression.
      items.push(
        ...((page.Items ?? []) as ReportItem[]).filter(
          (item) => !item.report_id.startsWith(LOCK_PREFIX),
        ),
      );
      startKey = page.LastEvaluatedKey;
    } while (startKey && items.length < LIST_MAX_ITEMS);

    const current = await Promise.all(
      items.slice(0, LIST_MAX_ITEMS).map((item) => this.expireIfStale(item)),
    );
    return current
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .map((item) => this.toView(item));
  }

  async regenerate(
    reportId: string,
    campaignId?: string,
    editInstructions?: string,
  ): Promise<ReportView> {
    this.requireConfigured();

    const current = await this.requireReport(reportId, campaignId);
    this.assertRegenerable(current);

    const now = new Date();
    const nowIso = now.toISOString();
    const max = this.maxEditAttempts();

    try {
      await this.withLockRetry(current.campaign_id, current.template_type, () =>
        this.aws.dynamodb.send(
          new TransactWriteCommand({
            TransactItems: [
              this.lockPut(
                current.campaign_id,
                current.template_type,
                reportId,
                now,
              ),
              {
                Update: {
                  TableName: this.tableName(),
                  Key: {
                    campaign_id: current.campaign_id,
                    report_id: reportId,
                  },
                  UpdateExpression:
                    'SET #status = :queued, attempt_count = :zero, last_error = :null, edit_instructions = :edit, updated_at = :now ADD edit_attempts :one',
                  ConditionExpression:
                    '#status = :complete AND (attribute_not_exists(edit_attempts) OR edit_attempts < :max)',
                  ExpressionAttributeNames: { '#status': 'status' },
                  ExpressionAttributeValues: {
                    ':queued': 'queued',
                    ':complete': 'complete',
                    ':zero': 0,
                    ':null': null,
                    ':edit': editInstructions?.trim() || null,
                    ':now': nowIso,
                    ':one': 1,
                    ':max': max,
                  },
                },
              },
            ],
          }),
        ),
      );
    } catch (err) {
      if (reportConditionFailed(err)) {
        this.assertRegenerable(
          await this.requireReport(reportId, current.campaign_id),
        );
        throw new ConflictException('Report cannot be regenerated right now');
      }
      throw err;
    }

    try {
      await this.enqueue(reportId, current.campaign_id);
    } catch (err) {
      this.logger.error(
        `[reports] regenerate enqueue failed reportId=${reportId}: ${errMessage(err)}`,
      );
      await this.revertRegenerate(current.campaign_id, reportId);
      await this.releaseLock(
        current.campaign_id,
        current.template_type,
        reportId,
      );
      throw new ServiceUnavailableException(
        'Could not queue report regeneration',
      );
    }

    this.logger.log(
      `[reports] regenerate queued reportId=${reportId} campaignId=${current.campaign_id} editAttempts=${(current.edit_attempts ?? 0) + 1}/${max}`,
    );
    return this.get(reportId, current.campaign_id);
  }

  /** Streams the PDF through the API so the S3 location is never exposed. */
  async openDownload(
    reportId: string,
    campaignId?: string,
  ): Promise<ReportDownload> {
    this.requireConfigured();
    const bucket = this.bucket();
    if (!bucket) {
      throw new ServiceUnavailableException(
        'Report downloads are not configured',
      );
    }

    const report = await this.requireReport(reportId, campaignId);
    const key = report.s3_key_pdf?.trim();
    if (report.status !== 'complete' || !key) {
      throw new ConflictException('Report is not ready for download');
    }
    if (
      !key.startsWith(PDF_KEY_PREFIX) ||
      !key.toLowerCase().endsWith('.pdf')
    ) {
      this.logger.error(
        `[reports] download rejected reportId=${reportId}: key is not a reports/ PDF`,
      );
      throw new ConflictException('Report is not ready for download');
    }

    let body: Readable;
    let contentType: string | undefined;
    let contentLength: number | undefined;
    try {
      const object = await this.aws.s3.send(
        new GetObjectCommand({ Bucket: bucket, Key: key }),
      );
      if (!object.Body) {
        throw new NotFoundException('Report file not found');
      }
      body = object.Body as Readable;
      contentType = object.ContentType;
      contentLength = object.ContentLength;
    } catch (err) {
      const name = (err as AwsError)?.name;
      if (name === 'NoSuchKey' || err instanceof NotFoundException) {
        throw new NotFoundException('Report file not found');
      }
      this.logger.error(
        `[reports] download failed reportId=${reportId}: ${name || errMessage(err)}`,
      );
      throw new ServiceUnavailableException('Report download is unavailable');
    }

    const mime = contentType?.split(';')[0].trim().toLowerCase();
    if (mime && !ALLOWED_PDF_CONTENT_TYPES.has(mime)) {
      body.destroy();
      this.logger.error(
        `[reports] download rejected reportId=${reportId}: content type ${mime}`,
      );
      throw new ConflictException('Report is not ready for download');
    }

    const stream = await requirePdfStream(body);
    if (!stream) {
      this.logger.error(
        `[reports] download rejected reportId=${reportId}: object is not a PDF`,
      );
      throw new ConflictException('Report is not ready for download');
    }

    return {
      stream,
      filename: downloadFilename(report),
      contentLength,
    };
  }

  private assertRegenerable(report: ReportItem): void {
    if (report.status !== 'complete') {
      throw new ConflictException(
        'Report can only be regenerated once generation is complete',
      );
    }
    if ((report.edit_attempts ?? 0) >= this.maxEditAttempts()) {
      throw new ConflictException(
        `Regenerate limit reached (${this.maxEditAttempts()})`,
      );
    }
  }

  private async requireReport(
    reportId: string,
    campaignId?: string,
  ): Promise<ReportItem> {
    if (reportId.startsWith(LOCK_PREFIX)) {
      throw new NotFoundException('Report not found');
    }

    let item: ReportItem | undefined;
    if (campaignId) {
      const res = await this.aws.dynamodb.send(
        new GetCommand({
          TableName: this.tableName(),
          Key: { campaign_id: campaignId, report_id: reportId },
          ConsistentRead: true,
        }),
      );
      item = res.Item as ReportItem | undefined;
    } else {
      const res = await this.aws.dynamodb.send(
        new QueryCommand({
          TableName: this.tableName(),
          IndexName: this.reportIdIndex(),
          KeyConditionExpression: 'report_id = :r',
          ExpressionAttributeValues: { ':r': reportId },
          Limit: 1,
        }),
      );
      item = res.Items?.[0] as ReportItem | undefined;
    }

    if (!item) throw new NotFoundException('Report not found');
    return item;
  }

  private lockPut(
    campaignId: string,
    templateType: string,
    reportId: string,
    now: Date,
  ) {
    const nowSec = Math.floor(now.getTime() / 1000);
    const lock: LockItem = {
      campaign_id: campaignId,
      report_id: `${LOCK_PREFIX}${templateType}`,
      locked_report_id: reportId,
      template_type: templateType,
      expires_at: nowSec + this.lockTtlSeconds(),
      created_at: now.toISOString(),
    };
    return {
      Put: {
        TableName: this.tableName(),
        Item: lock,
        ConditionExpression:
          'attribute_not_exists(report_id) OR expires_at < :nowSec',
        ExpressionAttributeValues: { ':nowSec': nowSec },
      },
    };
  }

  /**
   * Runs a transaction whose first item is the lock put. If the lock is held by a
   * report that already finished (worker did not release it), clears it and retries once.
   */
  private async withLockRetry(
    campaignId: string,
    templateType: string,
    run: () => Promise<unknown>,
  ): Promise<void> {
    try {
      await run();
      return;
    } catch (err) {
      if (!lockConditionFailed(err)) throw err;
    }

    if (!(await this.releaseStaleLock(campaignId, templateType))) {
      throw new ConflictException(
        'A report of this type is already being generated for this campaign',
      );
    }

    try {
      await run();
    } catch (err) {
      if (lockConditionFailed(err)) {
        throw new ConflictException(
          'A report of this type is already being generated for this campaign',
        );
      }
      throw err;
    }
  }

  private async releaseStaleLock(
    campaignId: string,
    templateType: string,
  ): Promise<boolean> {
    const res = await this.aws.dynamodb.send(
      new GetCommand({
        TableName: this.tableName(),
        Key: {
          campaign_id: campaignId,
          report_id: `${LOCK_PREFIX}${templateType}`,
        },
        ConsistentRead: true,
      }),
    );
    const lock = res.Item as LockItem | undefined;
    if (!lock) return true;

    const holder = await this.aws.dynamodb.send(
      new GetCommand({
        TableName: this.tableName(),
        Key: { campaign_id: campaignId, report_id: lock.locked_report_id },
        ConsistentRead: true,
      }),
    );
    const holderItem = holder.Item as ReportItem | undefined;
    if (holderItem && !TERMINAL_STATUSES.has(holderItem.status)) {
      const current = await this.expireIfStale(holderItem);
      if (!TERMINAL_STATUSES.has(current.status)) return false;
    }

    return this.releaseLock(campaignId, templateType, lock.locked_report_id);
  }

  private async releaseLock(
    campaignId: string,
    templateType: string,
    reportId: string,
  ): Promise<boolean> {
    try {
      await this.aws.dynamodb.send(
        new DeleteCommand({
          TableName: this.tableName(),
          Key: {
            campaign_id: campaignId,
            report_id: `${LOCK_PREFIX}${templateType}`,
          },
          ConditionExpression: 'locked_report_id = :r',
          ExpressionAttributeValues: { ':r': reportId },
        }),
      );
      return true;
    } catch (err) {
      if ((err as AwsError)?.name === 'ConditionalCheckFailedException') {
        return false;
      }
      this.logger.warn(
        `[reports] lock release failed campaignId=${campaignId} template=${templateType}: ${errMessage(err)}`,
      );
      return false;
    }
  }

  private async enqueue(reportId: string, campaignId: string): Promise<void> {
    await this.aws.sqs.send(
      new SendMessageCommand({
        QueueUrl: this.queueUrl(),
        MessageBody: JSON.stringify({ reportId, campaignId }),
      }),
    );
  }

  private async markEnqueueFailed(
    campaignId: string,
    reportId: string,
  ): Promise<void> {
    try {
      await this.aws.dynamodb.send(
        new UpdateCommand({
          TableName: this.tableName(),
          Key: { campaign_id: campaignId, report_id: reportId },
          UpdateExpression:
            'SET #status = :failed, last_error = :err, updated_at = :now',
          ExpressionAttributeNames: { '#status': 'status' },
          ExpressionAttributeValues: {
            ':failed': 'failed',
            ':err': 'enqueue_failed',
            ':now': new Date().toISOString(),
          },
        }),
      );
    } catch (err) {
      this.logger.warn(
        `[reports] could not mark enqueue failure reportId=${reportId}: ${errMessage(err)}`,
      );
    }
  }

  private async revertRegenerate(
    campaignId: string,
    reportId: string,
  ): Promise<void> {
    try {
      await this.aws.dynamodb.send(
        new UpdateCommand({
          TableName: this.tableName(),
          Key: { campaign_id: campaignId, report_id: reportId },
          UpdateExpression:
            'SET #status = :complete, updated_at = :now ADD edit_attempts :minusOne',
          ConditionExpression: '#status = :queued',
          ExpressionAttributeNames: { '#status': 'status' },
          ExpressionAttributeValues: {
            ':complete': 'complete',
            ':queued': 'queued',
            ':now': new Date().toISOString(),
            ':minusOne': -1,
          },
        }),
      );
    } catch (err) {
      this.logger.warn(
        `[reports] could not revert regenerate reportId=${reportId}: ${errMessage(err)}`,
      );
    }
  }

  private toView(item: ReportItem): ReportView {
    return {
      reportId: item.report_id,
      campaignId: item.campaign_id,
      templateType: item.template_type || DEFAULT_TEMPLATE_TYPE,
      status: item.status,
      sources: item.sources ?? [],
      dateRangeDays: item.date_range_days ?? null,
      windowStart: item.window_start ?? null,
      windowEnd: item.window_end,
      notifyEmails: item.notify_emails ?? [],
      attemptCount: item.attempt_count ?? 0,
      editAttempts: item.edit_attempts ?? 0,
      maxEditAttempts: this.maxEditAttempts(),
      lastError: item.last_error ?? null,
      requestedBy: item.requested_by,
      version: item.version ?? null,
      downloadAvailable: item.status === 'complete' && !!item.s3_key_pdf,
      createdAt: item.created_at,
      updatedAt: item.updated_at,
    };
  }

  /**
   * Claim the report-ready email for `version` (CPR-35). The conditional
   * write records notified_version, so it succeeds once per version: a
   * retried call from cht-reports gets null and sends nothing. Throws
   * NotFound for an unknown report, Conflict if the row is not complete at
   * that version.
   */
  async claimReadyNotification(
    campaignId: string,
    reportId: string,
    version: number,
  ): Promise<ReportItem | null> {
    this.requireConfigured();
    if (reportId.startsWith(LOCK_PREFIX)) {
      throw new NotFoundException('Report not found');
    }
    try {
      const res = await this.aws.dynamodb.send(
        new UpdateCommand({
          TableName: this.tableName(),
          Key: { campaign_id: campaignId, report_id: reportId },
          UpdateExpression: 'SET notified_version = :v, notified_at = :now',
          ConditionExpression:
            'attribute_exists(report_id) AND #status = :complete AND #version = :v AND (attribute_not_exists(notified_version) OR notified_version < :v)',
          ExpressionAttributeNames: {
            '#status': 'status',
            '#version': 'version',
          },
          ExpressionAttributeValues: {
            ':v': version,
            ':complete': 'complete',
            ':now': new Date().toISOString(),
          },
          ReturnValues: 'ALL_NEW',
        }),
      );
      return res.Attributes as ReportItem;
    } catch (err) {
      if ((err as AwsError)?.name !== 'ConditionalCheckFailedException') {
        throw err;
      }
      const report = await this.requireReport(reportId, campaignId);
      if ((report.notified_version ?? 0) >= version) return null;
      throw new ConflictException(
        `Report is not complete at version ${version}`,
      );
    }
  }

  /** Undo a claim when no email could be sent, so the caller's retry can send. */
  async releaseReadyNotification(
    campaignId: string,
    reportId: string,
    version: number,
  ): Promise<void> {
    try {
      await this.aws.dynamodb.send(
        new UpdateCommand({
          TableName: this.tableName(),
          Key: { campaign_id: campaignId, report_id: reportId },
          UpdateExpression: 'SET notified_version = :prev',
          ConditionExpression: 'notified_version = :v',
          ExpressionAttributeValues: { ':v': version, ':prev': version - 1 },
        }),
      );
    } catch (err) {
      this.logger.warn(
        `[reports] could not release ready notification reportId=${reportId} v${version}: ${errMessage(err)}`,
      );
    }
  }

  /**
   * An in-flight report with no progress for `staleMinutes` is stuck: the worker
   * crashed, or its message went to the DLQ. Mark it failed and free the campaign
   * lock so Generate works again. Conditional on updated_at, so a report that just
   * moved on is left alone.
   */
  private async expireIfStale(
    item: ReportItem,
    now: Date = new Date(),
  ): Promise<ReportItem> {
    if (TERMINAL_STATUSES.has(item.status)) return item;
    const minutes = this.staleMinutes();
    const lastProgress = Date.parse(item.updated_at);
    if (
      Number.isNaN(lastProgress) ||
      now.getTime() - lastProgress < minutes * 60_000
    ) {
      return item;
    }

    const lastError = `Timed out: no progress for ${minutes} minutes.`;
    try {
      const res = await this.aws.dynamodb.send(
        new UpdateCommand({
          TableName: this.tableName(),
          Key: { campaign_id: item.campaign_id, report_id: item.report_id },
          UpdateExpression:
            'SET #status = :failed, last_error = :err, updated_at = :now',
          ConditionExpression: '#status = :seen AND updated_at = :seenAt',
          ExpressionAttributeNames: { '#status': 'status' },
          ExpressionAttributeValues: {
            ':failed': 'failed',
            ':err': lastError,
            ':now': now.toISOString(),
            ':seen': item.status,
            ':seenAt': item.updated_at,
          },
          ReturnValues: 'ALL_NEW',
        }),
      );
      this.logger.warn(
        `[reports] timed out reportId=${item.report_id} campaignId=${item.campaign_id} status=${item.status}`,
      );
      await this.releaseLock(
        item.campaign_id,
        item.template_type || DEFAULT_TEMPLATE_TYPE,
        item.report_id,
      );
      return (
        (res.Attributes as ReportItem | undefined) ?? {
          ...item,
          status: 'failed',
          last_error: lastError,
          updated_at: now.toISOString(),
        }
      );
    } catch (err) {
      if ((err as AwsError)?.name === 'ConditionalCheckFailedException') {
        return item;
      }
      this.logger.warn(
        `[reports] could not time out reportId=${item.report_id}: ${errMessage(err)}`,
      );
      return item;
    }
  }

  private requireConfigured(): void {
    if (!this.isConfigured()) {
      throw new ServiceUnavailableException('Reports are not configured');
    }
  }

  private tableName(): string {
    return this.config.get<string>('reports.tableName') || '';
  }

  private reportIdIndex(): string {
    return (
      this.config.get<string>('reports.reportIdIndex') || 'report_id-index'
    );
  }

  private queueUrl(): string {
    return this.config.get<string>('reports.queueUrl') || '';
  }

  private bucket(): string {
    return this.config.get<string>('reports.bucket') || '';
  }

  private maxEditAttempts(): number {
    return this.config.get<number>('reports.maxEditAttempts') ?? 3;
  }

  private staleMinutes(): number {
    return this.config.get<number>('reports.staleMinutes') ?? 20;
  }

  private lockTtlSeconds(): number {
    return this.config.get<number>('reports.lockTtlSeconds') ?? 1800;
  }
}

/** Freezes the reporting window at request time; end never runs past now. */
export function freezeWindow(
  start: string | undefined,
  end: string | undefined,
  now: Date = new Date(),
  dateRangeDays?: number,
): { windowStart: string | null; windowEnd: string } {
  if (dateRangeDays) {
    if (start || end) {
      throw new BadRequestException(
        'Use dateRangeDays or windowStart/windowEnd, not both',
      );
    }
    return {
      windowStart: new Date(
        now.getTime() - dateRangeDays * 24 * 60 * 60 * 1000,
      ).toISOString(),
      windowEnd: now.toISOString(),
    };
  }

  const endDate = end ? new Date(end) : now;
  const frozenEnd = endDate.getTime() > now.getTime() ? now : endDate;
  const startDate = start ? new Date(start) : null;

  if (startDate && startDate.getTime() >= frozenEnd.getTime()) {
    throw new BadRequestException('windowStart must be before windowEnd');
  }

  return {
    windowStart: startDate ? startDate.toISOString() : null,
    windowEnd: frozenEnd.toISOString(),
  };
}

function lockConditionFailed(err: unknown): boolean {
  const e = err as AwsError;
  return (
    e?.name === 'TransactionCanceledException' &&
    e.CancellationReasons?.[0]?.Code === 'ConditionalCheckFailed'
  );
}

function reportConditionFailed(err: unknown): boolean {
  const e = err as AwsError;
  return (
    e?.name === 'TransactionCanceledException' &&
    e.CancellationReasons?.[1]?.Code === 'ConditionalCheckFailed'
  );
}

function downloadFilename(report: ReportItem): string {
  const safe = (s: string) => s.replace(/[^A-Za-z0-9_-]+/g, '_').slice(0, 80);
  const version = report.version ?? 1;
  return `${safe(report.campaign_id)}-${safe(report.template_type || DEFAULT_TEMPLATE_TYPE)}-v${version}.pdf`;
}

/**
 * Reads just enough of the object to confirm the `%PDF-` header, then returns
 * a stream that replays those bytes followed by the rest of the body.
 * Returns null (and destroys the body) when the object is not a PDF.
 */
async function requirePdfStream(body: Readable): Promise<Readable | null> {
  const iterator = body[Symbol.asyncIterator]() as AsyncIterator<
    Buffer | string
  >;
  const head: Buffer[] = [];
  let headLength = 0;
  try {
    while (headLength < PDF_MAGIC.length) {
      const next = await iterator.next();
      if (next.done) break;
      const chunk = Buffer.isBuffer(next.value)
        ? next.value
        : Buffer.from(next.value);
      head.push(chunk);
      headLength += chunk.length;
    }
  } catch {
    body.destroy();
    return null;
  }

  const prefix = Buffer.concat(head).subarray(0, PDF_MAGIC.length);
  if (!prefix.equals(PDF_MAGIC)) {
    body.destroy();
    return null;
  }

  return Readable.from(
    (async function* () {
      yield* head;
      for (;;) {
        const next = await iterator.next();
        if (next.done) return;
        yield next.value;
      }
    })(),
    { objectMode: false },
  );
}

function errMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
