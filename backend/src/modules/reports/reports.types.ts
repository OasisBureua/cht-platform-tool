/**
 * DynamoDB report job item (table owned by cht-reports, keyed campaign_id + report_id).
 * Platform creates the item and the per-campaign lock; the cht-reports worker updates
 * status in place and writes s3_key_pdf when the PDF is uploaded.
 */

/** Stored uppercase. Rows written before that are lowercase; see fromStoredItem. */
export type ReportStatus =
  | 'QUEUED'
  | 'PULLING_DATA'
  | 'GENERATING'
  | 'RENDERING'
  | 'UPLOADING'
  | 'WAITING_FOR_TRANSCRIPT'
  | 'COMPLETE'
  | 'FAILED';

export const TERMINAL_STATUSES: ReadonlySet<ReportStatus> = new Set([
  'COMPLETE',
  'FAILED',
]);

export const LOCK_PREFIX = 'LOCK#';

/** API / Hub catalog / S3 template identifier (lowercase). */
export const DEFAULT_TEMPLATE_TYPE = 'executive_summary';

/** Template type as the API, Hub catalog, lock key and download name use it. */
export function apiTemplateType(value?: string | null): string {
  return (value?.trim() || DEFAULT_TEMPLATE_TYPE).toLowerCase();
}

/** Template type as stored on report and lock rows (uppercase enum). */
export function storedTemplateType(value?: string | null): string {
  return apiTemplateType(value).toUpperCase();
}

/** Lock row key for a campaign + template type. Lowercase, as before the enum change. */
export function lockReportId(templateType?: string | null): string {
  return `${LOCK_PREFIX}${apiTemplateType(templateType)}`;
}

/** Both spellings of a status, for DynamoDB conditions on rows of either age. */
export function statusSpellings(status: ReportStatus): [string, string] {
  return [status, status.toLowerCase()];
}

/** A stored report row with status and template_type normalized to uppercase. */
export function fromStoredItem<
  T extends { status?: string; template_type?: string },
>(item: T): T {
  return {
    ...item,
    ...(item.status ? { status: item.status.toUpperCase() } : {}),
    ...(item.template_type
      ? { template_type: storedTemplateType(item.template_type) }
      : {}),
  };
}

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
