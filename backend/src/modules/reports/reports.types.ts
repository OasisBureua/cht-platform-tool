/**
 * DynamoDB report job item (table owned by cht-reports, keyed campaign_id + report_id).
 * Platform creates the item and the per-campaign lock; the cht-reports worker updates
 * status in place and writes s3_key_pdf when the PDF is uploaded.
 */

export type ReportStatus =
  | 'queued'
  | 'pulling_data'
  | 'generating'
  | 'rendering'
  | 'uploading'
  | 'waiting_for_transcript'
  | 'complete'
  | 'failed';

export const TERMINAL_STATUSES: ReadonlySet<ReportStatus> = new Set([
  'complete',
  'failed',
]);

export const LOCK_PREFIX = 'LOCK#';

export const DEFAULT_TEMPLATE_TYPE = 'executive_summary';

export type ReportItem = {
  campaign_id: string;
  report_id: string;
  template_type: string;
  sources: string[];
  date_range_days?: number | null;
  window_start: string | null;
  window_end: string;
  notify_emails?: string[];
  edit_instructions?: string | null;
  status: ReportStatus;
  attempt_count: number;
  edit_attempts: number;
  last_error: string | null;
  requested_by: string;
  s3_key_pdf?: string | null;
  version?: number | null;
  /** Last version whose report-ready email went out (CPR-35). */
  notified_version?: number | null;
  notified_at?: string | null;
  created_at: string;
  updated_at: string;
};

export type LockItem = {
  campaign_id: string;
  report_id: string;
  locked_report_id: string;
  template_type: string;
  created_at: string;
};

/** API shape. The S3 key is never exposed; clients download through the API. */
export type ReportView = {
  reportId: string;
  campaignId: string;
  templateType: string;
  status: ReportStatus;
  sources: string[];
  dateRangeDays: number | null;
  windowStart: string | null;
  windowEnd: string;
  notifyEmails: string[];
  attemptCount: number;
  editAttempts: number;
  maxEditAttempts: number;
  lastError: string | null;
  requestedBy: string;
  version: number | null;
  downloadAvailable: boolean;
  createdAt: string;
  updatedAt: string;
  /**
   * CPR-41 — set on create/regenerate only. Hub sync is best-effort after the
   * lock so a Hub 503 does not block Generate; `failed` means data may be stale.
   */
  warehouseSync?: 'ok' | 'failed';
};
