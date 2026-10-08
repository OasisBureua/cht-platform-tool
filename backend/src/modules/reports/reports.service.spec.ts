import {
  BadRequestException,
  ConflictException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Readable } from 'stream';
import { ReportsService, freezeWindow } from './reports.service';
import type { ReportsAwsClients } from './reports-aws.clients';
import type { ReportItem } from './reports.types';
import { ReportRecipientsService } from './report-recipients.service';
import type { PrismaService } from '../../prisma/prisma.service';
import type { CampaignExportIngestService } from '../content-hub/campaign-export-ingest.service';

async function readAll(stream: Readable): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream)
    chunks.push(Buffer.from(chunk as Uint8Array));
  return Buffer.concat(chunks).toString();
}

interface CommandInput {
  Key?: { report_id?: string };
}

interface SentCommand {
  constructor: { name: string };
  input: CommandInput;
}

type AttributeValues = Record<string, unknown>;

interface TransactInput {
  TransactItems: {
    Put: { Item: Record<string, unknown> };
    Update: {
      UpdateExpression: string;
      ExpressionAttributeValues: AttributeValues;
    };
  }[];
}

interface ExpressionInput {
  ExpressionAttributeValues: AttributeValues;
}

interface SendMessageInput {
  MessageBody: string;
}

type Handler = (command: string, input: CommandInput) => unknown;

const lockCancelled = () =>
  Object.assign(new Error('cancelled'), {
    name: 'TransactionCanceledException',
    CancellationReasons: [{ Code: 'ConditionalCheckFailed' }, { Code: 'None' }],
  });

const reportCancelled = () =>
  Object.assign(new Error('cancelled'), {
    name: 'TransactionCanceledException',
    CancellationReasons: [{ Code: 'None' }, { Code: 'ConditionalCheckFailed' }],
  });

function completeReport(overrides: Partial<ReportItem> = {}): ReportItem {
  return {
    campaign_id: 'AZ-25-01_LIV001',
    report_id: '6f1c2f5e-8a4b-4f7e-9a51-3b8d2e1c0a11',
    template_type: 'executive_summary',
    sources: [],
    window_start: null,
    window_end: '2026-09-20T00:00:00.000Z',
    status: 'complete',
    attempt_count: 1,
    edit_attempts: 0,
    last_error: null,
    requested_by: 'user-1',
    s3_key_pdf: 'reports/AZ-25-01_LIV001/6f1c2f5e/v1.pdf',
    version: 1,
    created_at: '2026-09-20T00:00:00.000Z',
    updated_at: '2026-09-20T00:05:00.000Z',
    ...overrides,
  };
}

function build(
  handler: Handler,
  configOverrides: Record<string, unknown> = {},
  exportIngestOverrides: Partial<CampaignExportIngestService> = {},
) {
  const map: Record<string, unknown> = {
    'reports.tableName': 'cht-dev-report-state',
    'reports.reportIdIndex': 'report_id-index',
    'reports.queueUrl':
      'https://sqs.us-east-1.amazonaws.com/1/cht-dev-report-requests',
    'reports.bucket': 'cht-reports-dev-artifacts',
    'reports.maxEditAttempts': 3,
    ...configOverrides,
  };
  const config = { get: (key: string) => map[key] } as unknown as ConfigService;
  const send = jest.fn((cmd: SentCommand) =>
    Promise.resolve().then(() => handler(cmd.constructor.name, cmd.input)),
  );
  const aws = {
    dynamodb: { send },
    sqs: { send },
    s3: { send },
  } as unknown as ReportsAwsClients;
  const prisma = {
    user: {
      findMany: jest.fn(({ where }: { where: { email?: { in: string[] } } }) =>
        Promise.resolve(
          ADMIN_EMAILS.filter((e) => where.email?.in.includes(e)).map(
            (email) => ({ email }),
          ),
        ),
      ),
    },
  } as unknown as PrismaService;
  const recipients = new ReportRecipientsService(prisma);
  const ingestCampaign = jest
    .fn()
    .mockResolvedValue({ status: 'success', campaignId: 42 });
  const exportIngest = {
    ingestCampaign,
    ...exportIngestOverrides,
  } as unknown as CampaignExportIngestService;
  return {
    service: new ReportsService(config, aws, recipients, exportIngest),
    send,
    ingestCampaign,
  };
}

const ADMIN_EMAILS = ['a@cht.com', 'b@cht.com'];

function calls<T = CommandInput>(
  send: jest.Mock<Promise<unknown>, [SentCommand]>,
  command: string,
): T[] {
  return send.mock.calls
    .map(([cmd]) => cmd)
    .filter((cmd) => cmd.constructor.name === command)
    .map((cmd) => cmd.input as T);
}

describe('ReportsService', () => {
  describe('create', () => {
    it('stores dateRangeDays as a frozen window and dedupes notifyEmails', async () => {
      const { service, send } = build(() => ({}));

      const view = await service.create(
        {
          campaignId: 'AZ-25-01_LIV001',
          dateRangeDays: 30,
          sources: ['zoom', 'surveys'],
          notifyEmails: ['a@cht.com', 'a@cht.com', 'b@cht.com'],
        },
        'user-1',
      );

      const [tx] = calls<TransactInput>(send, 'TransactWriteCommand');
      const item = tx.TransactItems[1].Put.Item;
      expect(item.date_range_days).toBe(30);
      expect(item.notify_emails).toEqual(['a@cht.com', 'b@cht.com']);
      expect(item.sources).toEqual(['zoom', 'surveys']);
      const days =
        (Date.parse(String(item.window_end)) -
          Date.parse(String(item.window_start))) /
        86_400_000;
      expect(days).toBe(30);
      expect(view.dateRangeDays).toBe(30);
      expect(view.notifyEmails).toEqual(['a@cht.com', 'b@cht.com']);
    });

    it('rejects notify emails that are not active admins', async () => {
      const { service, send } = build(() => ({}));

      await expect(
        service.create(
          {
            campaignId: 'AZ-25-01_LIV001',
            notifyEmails: ['a@cht.com', 'outsider@example.com'],
          },
          'user-1',
        ),
      ).rejects.toThrow('outsider@example.com');
      expect(send).not.toHaveBeenCalled();
    });

    it('writes lock + queued report, then enqueues { reportId, campaignId }', async () => {
      const { service, send } = build(() => ({}));

      const view = await service.create(
        { campaignId: 'AZ-25-01_LIV001' },
        'user-1',
      );

      expect(view.status).toBe('queued');
      expect(view.templateType).toBe('executive_summary');
      expect(view.editAttempts).toBe(0);
      expect(view.downloadAvailable).toBe(false);
      expect(view).not.toHaveProperty('s3KeyPdf');

      const [tx] = calls<TransactInput>(send, 'TransactWriteCommand');
      expect(tx.TransactItems[0].Put.Item.report_id).toBe(
        'LOCK#executive_summary',
      );
      expect(tx.TransactItems[0].Put.Item.locked_report_id).toBe(view.reportId);
      expect(
        (tx.TransactItems[0].Put as { ConditionExpression?: string })
          .ConditionExpression,
      ).toBe('attribute_not_exists(report_id)');
      expect(tx.TransactItems[0].Put.Item).not.toHaveProperty('expires_at');
      expect(tx.TransactItems[1].Put.Item).toMatchObject({
        campaign_id: 'AZ-25-01_LIV001',
        status: 'queued',
        edit_attempts: 0,
        requested_by: 'user-1',
      });

      const [msg] = calls<SendMessageInput>(send, 'SendMessageCommand');
      expect(JSON.parse(msg.MessageBody)).toEqual({
        reportId: view.reportId,
        campaignId: 'AZ-25-01_LIV001',
      });
    });

    it('returns 409 when another report of the type is still generating', async () => {
      const { service } = build((command, input) => {
        if (command === 'TransactWriteCommand') throw lockCancelled();
        if (
          command === 'GetCommand' &&
          input.Key?.report_id === 'LOCK#executive_summary'
        ) {
          return { Item: { locked_report_id: 'r-active' } };
        }
        if (command === 'GetCommand') return { Item: { status: 'generating' } };
        return {};
      });

      await expect(
        service.create({ campaignId: 'AZ-25-01_LIV001' }, 'user-1'),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('clears a lock left by a finished report and retries once', async () => {
      let attempts = 0;
      const { service, send } = build((command, input) => {
        if (command === 'TransactWriteCommand') {
          attempts += 1;
          if (attempts === 1) throw lockCancelled();
          return {};
        }
        if (
          command === 'GetCommand' &&
          input.Key?.report_id === 'LOCK#executive_summary'
        ) {
          return { Item: { locked_report_id: 'r-done' } };
        }
        if (command === 'GetCommand') return { Item: { status: 'complete' } };
        return {};
      });

      const view = await service.create(
        { campaignId: 'AZ-25-01_LIV001' },
        'user-1',
      );

      expect(view.status).toBe('queued');
      expect(attempts).toBe(2);
      const [del] = calls<ExpressionInput>(send, 'DeleteCommand');
      expect(del.ExpressionAttributeValues[':r']).toBe('r-done');
    });

    it('marks the report failed and releases the lock when enqueue fails', async () => {
      const { service, send } = build((command) => {
        if (command === 'SendMessageCommand') throw new Error('sqs down');
        return {};
      });

      await expect(
        service.create({ campaignId: 'AZ-25-01_LIV001' }, 'user-1'),
      ).rejects.toBeInstanceOf(ServiceUnavailableException);

      const [update] = calls<ExpressionInput>(send, 'UpdateCommand');
      expect(update.ExpressionAttributeValues[':failed']).toBe('failed');
      expect(calls(send, 'DeleteCommand')).toHaveLength(1);
    });

    it('validates and locks before Hub ingest, then enqueues even if ingest fails', async () => {
      const order: string[] = [];
      const ingestCampaign = jest.fn().mockImplementation(async () => {
        order.push('ingest');
        throw new ServiceUnavailableException('Hub down');
      });
      const { service, send } = build(
        (command) => {
          if (command === 'TransactWriteCommand') order.push('lock');
          if (command === 'SendMessageCommand') order.push('enqueue');
          return {};
        },
        {},
        { ingestCampaign } as Partial<CampaignExportIngestService>,
      );

      const view = await service.create({ campaignId: '42' }, 'user-1');

      expect(order).toEqual(['lock', 'ingest', 'enqueue']);
      expect(ingestCampaign).toHaveBeenCalledWith('42', 'platform_generate');
      expect(view.warehouseSync).toBe('failed');
      expect(view.status).toBe('queued');
      expect(calls(send, 'SendMessageCommand')).toHaveLength(1);
    });

    it('refreshCampaignData rejects when a report is in flight', async () => {
      const { service } = build((command, input) => {
        if (
          command === 'GetCommand' &&
          input.Key?.report_id === 'LOCK#executive_summary'
        ) {
          return { Item: { locked_report_id: 'r-live' } };
        }
        if (command === 'GetCommand' && input.Key?.report_id === 'r-live') {
          return {
            Item: completeReport({
              report_id: 'r-live',
              status: 'generating',
              updated_at: new Date().toISOString(),
            }),
          };
        }
        return {};
      });

      await expect(service.refreshCampaignData('42')).rejects.toBeInstanceOf(
        ConflictException,
      );
    });

    it('refreshCampaignData ingests when no report is in flight', async () => {
      const ingestCampaign = jest
        .fn()
        .mockResolvedValue({ status: 'success', sessionsUpserted: 2 });
      const { service } = build(
        () => ({}),
        {},
        { ingestCampaign } as Partial<CampaignExportIngestService>,
      );

      await expect(service.refreshCampaignData('42')).resolves.toEqual({
        status: 'success',
        sessionsUpserted: 2,
      });
      expect(ingestCampaign).toHaveBeenCalledWith('42', 'platform_refresh');
    });

    it('returns 503 when reports are not configured', async () => {
      const { service } = build(() => ({}), { 'reports.tableName': '' });
      await expect(
        service.create({ campaignId: 'AZ-25-01_LIV001' }, 'user-1'),
      ).rejects.toBeInstanceOf(ServiceUnavailableException);
    });
  });

  describe('list', () => {
    it('hides lock rows without filtering on the sort key', async () => {
      const { service, send } = build((command) =>
        command === 'QueryCommand'
          ? {
              Items: [
                completeReport(),
                {
                  campaign_id: 'AZ-25-01_LIV001',
                  report_id: 'LOCK#executive_summary',
                  locked_report_id: 'r-1',
                },
              ],
            }
          : {},
      );

      const views = await service.list('AZ-25-01_LIV001');

      expect(views.map((v) => v.reportId)).toEqual([
        completeReport().report_id,
      ]);
      const [query] = calls<{ FilterExpression?: string }>(
        send,
        'QueryCommand',
      );
      expect(query.FilterExpression).toBeUndefined();
    });
  });

  describe('stuck reports', () => {
    const minutesAgo = (m: number) =>
      new Date(Date.now() - m * 60_000).toISOString();

    it('marks an in-flight report with no progress for 20 minutes as failed and frees the lock', async () => {
      const stuck = completeReport({
        status: 'generating',
        s3_key_pdf: null,
        updated_at: minutesAgo(25),
      });
      const { service, send } = build((command) => {
        if (command === 'QueryCommand') return { Items: [stuck] };
        if (command === 'UpdateCommand')
          return {
            Attributes: {
              ...stuck,
              status: 'failed',
              last_error: 'Timed out: no progress for 20 minutes.',
            },
          };
        return {};
      });

      const [view] = await service.list('AZ-25-01_LIV001');

      expect(view.status).toBe('failed');
      expect(view.lastError).toBe('Timed out: no progress for 20 minutes.');
      const [update] = calls<ExpressionInput & { ConditionExpression: string }>(
        send,
        'UpdateCommand',
      );
      expect(update.ConditionExpression).toBe(
        '#status = :seen AND updated_at = :seenAt',
      );
      expect(update.ExpressionAttributeValues[':seen']).toBe('generating');
      expect(calls(send, 'DeleteCommand')).toHaveLength(1);
    });

    it('leaves a report that is still making progress alone', async () => {
      const running = completeReport({
        status: 'generating',
        s3_key_pdf: null,
        updated_at: minutesAgo(5),
      });
      const { service, send } = build((command) =>
        command === 'GetCommand' ? { Item: running } : {},
      );

      const view = await service.get(running.report_id, 'AZ-25-01_LIV001');

      expect(view.status).toBe('generating');
      expect(calls(send, 'UpdateCommand')).toHaveLength(0);
    });

    it('keeps the lock while a report waits hours for its transcript', async () => {
      const waiting = completeReport({
        report_id: 'waiting-1',
        status: 'waiting_for_transcript',
        s3_key_pdf: null,
        created_at: minutesAgo(120),
        updated_at: minutesAgo(3),
      });
      const { service, send } = build((command, input) => {
        if (command === 'TransactWriteCommand') throw lockCancelled();
        if (command === 'GetCommand') {
          return input.Key?.report_id === 'LOCK#executive_summary'
            ? { Item: { locked_report_id: 'waiting-1' } }
            : { Item: waiting };
        }
        return {};
      });

      await expect(
        service.create({ campaignId: 'AZ-25-01_LIV001' }, 'user-1'),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(calls(send, 'DeleteCommand')).toHaveLength(0);
    });

    it('lets Generate through when the lock holder is stuck', async () => {
      const stuck = completeReport({
        report_id: 'stuck-1',
        status: 'pulling_data',
        s3_key_pdf: null,
        updated_at: minutesAgo(40),
      });
      let transactCalls = 0;
      const { service } = build((command, input) => {
        if (command === 'TransactWriteCommand') {
          transactCalls += 1;
          if (transactCalls === 1) throw lockCancelled();
          return {};
        }
        if (command === 'GetCommand') {
          return input.Key?.report_id === 'LOCK#executive_summary'
            ? {
                Item: {
                  campaign_id: 'AZ-25-01_LIV001',
                  report_id: 'LOCK#executive_summary',
                  locked_report_id: 'stuck-1',
                },
              }
            : { Item: stuck };
        }
        if (command === 'UpdateCommand')
          return { Attributes: { ...stuck, status: 'failed' } };
        return {};
      });

      const view = await service.create(
        { campaignId: 'AZ-25-01_LIV001', notifyEmails: [] },
        'user-1',
      );

      expect(view.status).toBe('queued');
      expect(transactCalls).toBe(2);
    });
  });

  describe('regenerate', () => {
    it('queues a completed report and increments edit_attempts', async () => {
      let item = completeReport({ campaign_id: '42' });
      const order: string[] = [];
      const ingestCampaign = jest.fn().mockImplementation(async () => {
        order.push('ingest');
        return { status: 'success' };
      });
      const { service, send } = build(
        (command) => {
          if (command === 'GetCommand') return { Item: item };
          if (command === 'TransactWriteCommand') {
            order.push('lock');
            item = {
              ...item,
              status: 'queued',
              edit_attempts: item.edit_attempts + 1,
              updated_at: new Date().toISOString(),
            };
            return {};
          }
          if (command === 'SendMessageCommand') order.push('enqueue');
          return {};
        },
        {},
        { ingestCampaign } as Partial<CampaignExportIngestService>,
      );

      const view = await service.regenerate(
        item.report_id,
        item.campaign_id,
        '  Shorten the summary  ',
      );

      expect(order).toEqual(['lock', 'ingest', 'enqueue']);
      expect(ingestCampaign).toHaveBeenCalledWith('42', 'platform_generate');
      expect(view.warehouseSync).toBe('ok');
      expect(view.status).toBe('queued');
      expect(view.editAttempts).toBe(1);
      const [tx] = calls<TransactInput>(send, 'TransactWriteCommand');
      expect(
        tx.TransactItems[1].Update.ExpressionAttributeValues[':edit'],
      ).toBe('Shorten the summary');
      expect(tx.TransactItems[1].Update.UpdateExpression).toContain(
        'ADD edit_attempts :one',
      );
      expect(tx.TransactItems[1].Update.ExpressionAttributeValues[':max']).toBe(
        3,
      );
      expect(calls(send, 'SendMessageCommand')).toHaveLength(1);
    });

    it('returns 409 when the report is not complete', async () => {
      const { service, send } = build(() => ({
        Item: completeReport({ status: 'generating' }),
      }));

      await expect(
        service.regenerate(completeReport().report_id, 'AZ-25-01_LIV001'),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(calls(send, 'TransactWriteCommand')).toHaveLength(0);
    });

    it('returns 409 on the 4th regenerate (edit_attempts = 3)', async () => {
      const { service, send } = build(() => ({
        Item: completeReport({ edit_attempts: 3 }),
      }));

      await expect(
        service.regenerate(completeReport().report_id, 'AZ-25-01_LIV001'),
      ).rejects.toThrow('Regenerate limit reached (3)');
      expect(calls(send, 'SendMessageCommand')).toHaveLength(0);
    });

    it('returns 409 when the condition fails on a concurrent regenerate', async () => {
      let reads = 0;
      const { service } = build((command) => {
        if (command === 'GetCommand') {
          reads += 1;
          return {
            Item:
              reads === 1
                ? completeReport({ edit_attempts: 2 })
                : completeReport({ edit_attempts: 3 }),
          };
        }
        if (command === 'TransactWriteCommand') throw reportCancelled();
        return {};
      });

      await expect(
        service.regenerate(completeReport().report_id, 'AZ-25-01_LIV001'),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('openDownload', () => {
    it('returns 409 until the report is complete', async () => {
      const { service } = build(() => ({
        Item: completeReport({ status: 'rendering', s3_key_pdf: null }),
      }));

      await expect(
        service.openDownload(completeReport().report_id, 'AZ-25-01_LIV001'),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('streams the PDF with a friendly filename (no S3 URL)', async () => {
      const body = Readable.from([Buffer.from('%PD'), Buffer.from('F-1.7 x')]);
      const { service, send } = build((command) => {
        if (command === 'GetCommand') return { Item: completeReport() };
        if (command === 'GetObjectCommand')
          return {
            Body: body,
            ContentLength: 10,
            ContentType: 'application/pdf',
          };
        return {};
      });

      const file = await service.openDownload(
        completeReport().report_id,
        'AZ-25-01_LIV001',
      );

      expect(await readAll(file.stream)).toBe('%PDF-1.7 x');
      expect(file.filename).toBe('AZ-25-01_LIV001-executive_summary-v1.pdf');
      expect(file.contentLength).toBe(10);
      const [get] = calls(send, 'GetObjectCommand');
      expect(get).toEqual({
        Bucket: 'cht-reports-dev-artifacts',
        Key: 'reports/AZ-25-01_LIV001/6f1c2f5e/v1.pdf',
      });
    });

    it('rejects keys outside the reports/ prefix', async () => {
      const { service, send } = build(() => ({
        Item: completeReport({ s3_key_pdf: 'zoom-recordings/x.vtt' }),
      }));

      await expect(
        service.openDownload(completeReport().report_id, 'AZ-25-01_LIV001'),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(calls(send, 'GetObjectCommand')).toHaveLength(0);
    });

    it('rejects non-PDF keys without touching S3', async () => {
      const { service, send } = build(() => ({
        Item: completeReport({ s3_key_pdf: 'reports/AZ/6f1c/v1.html' }),
      }));

      await expect(
        service.openDownload(completeReport().report_id, 'AZ-25-01_LIV001'),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(calls(send, 'GetObjectCommand')).toHaveLength(0);
    });

    it('rejects an HTML content type', async () => {
      const { service } = build((command) => {
        if (command === 'GetCommand') return { Item: completeReport() };
        return {
          Body: Readable.from(['%PDF-1.7']),
          ContentType: 'text/html; charset=utf-8',
        };
      });

      await expect(
        service.openDownload(completeReport().report_id, 'AZ-25-01_LIV001'),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('rejects HTML bytes saved under a .pdf key', async () => {
      const { service } = build((command) => {
        if (command === 'GetCommand') return { Item: completeReport() };
        return { Body: Readable.from(['<!DOCTYPE html><html>']) };
      });

      await expect(
        service.openDownload(completeReport().report_id, 'AZ-25-01_LIV001'),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('claimReadyNotification', () => {
    const conditionFailed = () =>
      Object.assign(new Error('failed'), {
        name: 'ConditionalCheckFailedException',
      });
    const reportId = completeReport().report_id;

    it('claims the version with a conditional write and returns the row', async () => {
      const { service, send } = build((command) =>
        command === 'UpdateCommand'
          ? { Attributes: completeReport({ notified_version: 1 }) }
          : {},
      );

      const row = await service.claimReadyNotification(
        'AZ-25-01_LIV001',
        reportId,
        1,
      );

      expect(row?.notified_version).toBe(1);
      const [update] = calls<
        ExpressionInput & {
          ConditionExpression: string;
          UpdateExpression: string;
        }
      >(send, 'UpdateCommand');
      expect(update.UpdateExpression).toContain('notified_version = :v');
      expect(update.ConditionExpression).toContain('#status = :complete');
      expect(update.ConditionExpression).toContain('#version = :v');
      expect(update.ConditionExpression).toContain('notified_version < :v');
      expect(update.ExpressionAttributeValues[':v']).toBe(1);
    });

    it('returns null when that version was already emailed (retry is a no-op)', async () => {
      const { service } = build((command) => {
        if (command === 'UpdateCommand') throw conditionFailed();
        return { Item: completeReport({ version: 2, notified_version: 2 }) };
      });

      await expect(
        service.claimReadyNotification('AZ-25-01_LIV001', reportId, 2),
      ).resolves.toBeNull();
    });

    it('409s when the row is not complete at that version', async () => {
      const { service } = build((command) => {
        if (command === 'UpdateCommand') throw conditionFailed();
        return { Item: completeReport({ status: 'generating', version: 1 }) };
      });

      await expect(
        service.claimReadyNotification('AZ-25-01_LIV001', reportId, 2),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('404s for an unknown report or a lock row id', async () => {
      const { service } = build((command) => {
        if (command === 'UpdateCommand') throw conditionFailed();
        return {};
      });

      await expect(
        service.claimReadyNotification('AZ-25-01_LIV001', reportId, 1),
      ).rejects.toThrow('Report not found');
      await expect(
        service.claimReadyNotification('AZ-25-01_LIV001', 'LOCK#x', 1),
      ).rejects.toThrow('Report not found');
    });

    it('release sets notified_version back one, only if still at this version', async () => {
      const { service, send } = build(() => ({}));

      await service.releaseReadyNotification('AZ-25-01_LIV001', reportId, 2);

      const [update] = calls<ExpressionInput & { ConditionExpression: string }>(
        send,
        'UpdateCommand',
      );
      expect(update.ConditionExpression).toBe('notified_version = :v');
      expect(update.ExpressionAttributeValues).toEqual({ ':v': 2, ':prev': 1 });
    });
  });

  describe('freezeWindow', () => {
    const now = new Date('2026-09-28T12:00:00.000Z');

    it('freezes the end at request time when omitted', () => {
      expect(freezeWindow(undefined, undefined, now)).toEqual({
        windowStart: null,
        windowEnd: '2026-09-28T12:00:00.000Z',
      });
    });

    it('clamps a future end to now', () => {
      expect(
        freezeWindow('2026-09-01T00:00:00Z', '2026-12-01T00:00:00Z', now)
          .windowEnd,
      ).toBe('2026-09-28T12:00:00.000Z');
    });

    it('uses the last N days when dateRangeDays is set', () => {
      expect(freezeWindow(undefined, undefined, now, 90)).toEqual({
        windowStart: '2026-06-30T12:00:00.000Z',
        windowEnd: '2026-09-28T12:00:00.000Z',
      });
    });

    it('rejects dateRangeDays combined with an explicit window', () => {
      expect(() =>
        freezeWindow('2026-09-01T00:00:00Z', undefined, now, 30),
      ).toThrow(BadRequestException);
    });

    it('rejects a start that is not before the end', () => {
      expect(() =>
        freezeWindow('2026-09-28T12:00:00Z', '2026-09-01T00:00:00Z', now),
      ).toThrow(BadRequestException);
    });
  });
});
