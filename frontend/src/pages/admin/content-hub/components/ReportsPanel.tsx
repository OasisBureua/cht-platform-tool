import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { format, parseISO } from 'date-fns';
import {
  CheckCircle2,
  Clock,
  Download,
  FileText,
  Link2,
  Loader2,
  Mail,
  RefreshCw,
  Sparkles,
  XCircle,
} from 'lucide-react';
import {
  Button,
  ZoomAlert,
  ZoomEmptyState,
  ZoomJobBanner,
  ZoomLoadingState,
  ZoomSectionCard,
  ZoomStatusBadge,
} from '../../../../components/admin/zoom-recordings/ZoomRecordingsUi';
import { SegmentedControl } from '../../../../components/ui';
import { cn } from '../../../../lib/cn';
import {
  REPORT_IN_FLIGHT,
  reportErrorMessage,
  type DateRangeDays,
  type Report,
  type ReportStatus,
} from '../../../../api/reports';
import {
  useCampaignReports,
  useCreateReport,
  useDownloadReport,
  useRegenerateReport,
  useReportRecipients,
} from '../lib/reportHooks';
import { useToast } from './Toaster';

const REPORT_SOURCES: Array<{ value: string; label: string }> = [
  { value: 'hubspot', label: 'HubSpot' },
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'meta', label: 'Meta' },
  { value: 'youtube', label: 'YouTube' },
  { value: 'livestream', label: 'Livestream' },
  { value: 'sessions', label: 'Zoom sessions' },
  { value: 'surveys', label: 'Surveys' },
];

const SOURCE_LABEL = new Map(REPORT_SOURCES.map((s) => [s.value, s.label]));

const RANGE_SEGMENTS: Array<{ value: `${DateRangeDays}`; label: string }> = [
  { value: '30', label: 'Last 30 days' },
  { value: '60', label: 'Last 60 days' },
  { value: '90', label: 'Last 90 days' },
];

const PIPELINE: ReportStatus[] = [
  'queued',
  'pulling_data',
  'generating',
  'rendering',
  'uploading',
  'complete',
];

const STATUS_LABEL: Record<ReportStatus, string> = {
  queued: 'Queued',
  pulling_data: 'Pulling data',
  generating: 'Writing report',
  rendering: 'Printing PDF',
  uploading: 'Saving PDF',
  complete: 'Ready',
  failed: 'Failed',
};

function fmtDate(iso: string | null | undefined, pattern = 'MMM d, yyyy'): string {
  if (!iso) return '—';
  try {
    return format(parseISO(iso), pattern);
  } catch {
    return '—';
  }
}

function windowLabel(r: Report): string {
  const end = fmtDate(r.windowEnd);
  if (r.dateRangeDays) return `Last ${r.dateRangeDays} days · to ${end}`;
  return r.windowStart ? `${fmtDate(r.windowStart)} – ${end}` : `Campaign to ${end}`;
}

function StatusBadge({ status }: { status: ReportStatus }) {
  if (status === 'complete') {
    return (
      <ZoomStatusBadge tone="success" icon={CheckCircle2}>
        Ready
      </ZoomStatusBadge>
    );
  }
  if (status === 'failed') {
    return (
      <ZoomStatusBadge tone="error" icon={XCircle}>
        Failed
      </ZoomStatusBadge>
    );
  }
  return (
    <ZoomStatusBadge tone="info" icon={Loader2} className="[&_svg]:animate-spin">
      {STATUS_LABEL[status]}
    </ZoomStatusBadge>
  );
}

function ToggleChip({
  on,
  onClick,
  children,
  title,
}: {
  on: boolean;
  onClick: () => void;
  children: ReactNode;
  title?: string;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={on}
      title={title}
      onClick={onClick}
      className={cn(
        'inline-flex h-9 items-center gap-1.5 rounded-[6px] px-3 text-sm transition-[background-color,color,box-shadow] duration-150',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
        on
          ? 'bg-brand-600 text-white shadow-card hover:bg-brand-700'
          : 'bg-card text-muted-foreground shadow-card hover:bg-muted hover:text-foreground',
      )}
    >
      {on ? <CheckCircle2 className="h-3.5 w-3.5" aria-hidden /> : null}
      {children}
    </button>
  );
}

function InFlightBanner({ report }: { report: Report }) {
  const step = Math.max(0, PIPELINE.indexOf(report.status));
  const pct = Math.round(((step + 1) / PIPELINE.length) * 100);
  return (
    <ZoomJobBanner
      tone="running"
      title={report.editAttempts > 0 ? 'Regenerating report' : 'Generating report'}
      progress={{ pct, label: `${STATUS_LABEL[report.status]} · step ${step + 1} of ${PIPELINE.length - 1}` }}
      detail={`${windowLabel(report)}. This page updates automatically.`}
    />
  );
}

function GenerateCard({
  campaignId,
  linkedProgramCount,
  busy,
  onGoToPrograms,
}: {
  campaignId: string;
  linkedProgramCount: number;
  busy: boolean;
  onGoToPrograms: () => void;
}) {
  const { toast } = useToast();
  const [range, setRange] = useState<`${DateRangeDays}`>('30');
  const [sources, setSources] = useState<string[]>(REPORT_SOURCES.map((s) => s.value));
  const [notify, setNotify] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const recipients = useReportRecipients();
  const create = useCreateReport(campaignId);

  const toggle = (list: string[], value: string) =>
    list.includes(value) ? list.filter((v) => v !== value) : [...list, value];

  const submit = () => {
    setError(null);
    create.mutate(
      {
        dateRangeDays: Number(range) as DateRangeDays,
        sources,
        notifyEmails: notify,
      },
      {
        onSuccess: () =>
          toast({
            title: 'Report queued',
            description: 'We will keep this page updated while the PDF is generated.',
          }),
        onError: async (err) =>
          setError(await reportErrorMessage(err, 'Could not queue the report. Try again shortly.')),
      },
    );
  };

  return (
    <ZoomSectionCard
      title="Generate executive report"
      description="Pull the selected sources for the chosen window and print a PDF. Only one report per campaign can generate at a time."
    >
      <div className="space-y-6">
        {linkedProgramCount === 0 ? (
          <ZoomAlert tone="warning" title="No programs linked">
            Zoom sessions, attendance and surveys from Platform are only included for programs linked to
            this campaign.{' '}
            <button type="button" onClick={onGoToPrograms} className="font-medium underline underline-offset-2">
              Link programs
            </button>
          </ZoomAlert>
        ) : null}

        <div>
          <p className="text-sm text-muted-foreground">Date range</p>
          <SegmentedControl
            className="mt-2"
            label="Report date range"
            segments={RANGE_SEGMENTS}
            value={range}
            onChange={setRange}
          />
        </div>

        <div>
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-sm text-muted-foreground">Sources</p>
            <button
              type="button"
              className="text-xs font-medium text-brand-600 hover:underline"
              onClick={() =>
                setSources(
                  sources.length === REPORT_SOURCES.length ? [] : REPORT_SOURCES.map((s) => s.value),
                )
              }
            >
              {sources.length === REPORT_SOURCES.length ? 'Clear all' : 'Select all'}
            </button>
          </div>
          <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label="Report sources">
            {REPORT_SOURCES.map((s) => (
              <ToggleChip
                key={s.value}
                on={sources.includes(s.value)}
                onClick={() => setSources((prev) => toggle(prev, s.value))}
              >
                {s.label}
              </ToggleChip>
            ))}
          </div>
          {sources.length === 0 ? (
            <p className="mt-2 text-sm text-destructive">Pick at least one source.</p>
          ) : null}
        </div>

        <div>
          <p className="text-sm text-muted-foreground">Notify when ready (optional)</p>
          {recipients.isLoading ? (
            <p className="mt-2 text-sm text-muted-foreground">Loading admins…</p>
          ) : recipients.data && recipients.data.length > 0 ? (
            <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label="Notify admins">
              {recipients.data.map((r) => (
                <ToggleChip
                  key={r.userId}
                  on={notify.includes(r.email)}
                  title={r.email}
                  onClick={() => setNotify((prev) => toggle(prev, r.email))}
                >
                  <Mail className={cn('h-3.5 w-3.5', notify.includes(r.email) && 'hidden')} aria-hidden />
                  {r.name || r.email}
                </ToggleChip>
              ))}
            </div>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">No active admins found.</p>
          )}
        </div>

        {error ? <ZoomAlert tone="error">{error}</ZoomAlert> : null}

        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={submit} disabled={busy || create.isPending || sources.length === 0}>
            {create.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <Sparkles className="h-4 w-4" aria-hidden />
            )}
            {create.isPending ? 'Queuing…' : 'Generate report'}
          </Button>
          {busy ? (
            <p className="text-sm text-muted-foreground">A report is already generating for this campaign.</p>
          ) : null}
        </div>
      </div>
    </ZoomSectionCard>
  );
}

function RegenerateForm({
  report,
  onCancel,
  onDone,
}: {
  report: Report;
  onCancel: () => void;
  onDone: () => void;
}) {
  const { toast } = useToast();
  const [instructions, setInstructions] = useState('');
  const [error, setError] = useState<string | null>(null);
  const regenerate = useRegenerateReport(report.campaignId);
  const left = report.maxEditAttempts - report.editAttempts;

  const submit = () => {
    setError(null);
    regenerate.mutate(
      { reportId: report.reportId, editInstructions: instructions },
      {
        onSuccess: () => {
          toast({ title: 'Regenerating report' });
          onDone();
        },
        onError: async (err) =>
          setError(await reportErrorMessage(err, 'Could not regenerate the report.')),
      },
    );
  };

  return (
    <div className="mt-3 space-y-3 rounded-[8px] bg-muted/40 p-4">
      <label className="block text-sm text-muted-foreground" htmlFor={`edit-${report.reportId}`}>
        What should change? (optional) · {left} of {report.maxEditAttempts} regenerations left
      </label>
      <textarea
        id={`edit-${report.reportId}`}
        rows={3}
        maxLength={2000}
        value={instructions}
        onChange={(e) => setInstructions(e.target.value)}
        placeholder="e.g. Shorten the executive summary and add attendance trends"
        className="w-full rounded-[6px] bg-card px-3 py-2 text-sm text-foreground shadow-card outline-none placeholder:text-muted-foreground/70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      />
      {error ? <ZoomAlert tone="error">{error}</ZoomAlert> : null}
      <div className="flex gap-2">
        <Button size="sm" onClick={submit} disabled={regenerate.isPending}>
          {regenerate.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          Regenerate
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

function ReportRow({ report, blocked }: { report: Report; blocked: boolean }) {
  const { toast } = useToast();
  const download = useDownloadReport();
  const [editing, setEditing] = useState(false);
  const canRegenerate =
    report.status === 'complete' && report.editAttempts < report.maxEditAttempts && !blocked;

  const doDownload = () =>
    download.mutate(report, {
      onError: async (err) =>
        toast({
          title: 'Download failed',
          description: await reportErrorMessage(err, 'The PDF is not available right now.'),
          variant: 'destructive',
        }),
    });

  return (
    <li className="px-5 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <div className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-[8px] bg-muted/80 text-muted-foreground">
            <FileText className="h-4 w-4" aria-hidden />
          </div>
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-medium text-foreground">
                Executive report{report.version && report.version > 1 ? ` · v${report.version}` : ''}
              </p>
              <StatusBadge status={report.status} />
            </div>
            <p className="text-sm text-muted-foreground">{windowLabel(report)}</p>
            <p className="text-xs text-muted-foreground">
              {report.sources.length > 0
                ? report.sources.map((s) => SOURCE_LABEL.get(s) ?? s).join(' · ')
                : 'All sources'}
            </p>
            <p className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" aria-hidden />
              Requested {fmtDate(report.createdAt, 'MMM d, yyyy · h:mm a')}
              {report.editAttempts > 0
                ? ` · ${report.editAttempts}/${report.maxEditAttempts} regenerations used`
                : ''}
            </p>
            {report.status === 'failed' && report.lastError ? (
              <p className="text-xs text-destructive">Generation failed. Try generating a new report.</p>
            ) : null}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {report.downloadAvailable ? (
            <Button size="sm" onClick={doDownload} disabled={download.isPending}>
              {download.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
              Download PDF
            </Button>
          ) : null}
          {canRegenerate && !editing ? (
            <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
              <RefreshCw className="h-3.5 w-3.5" />
              Regenerate
            </Button>
          ) : null}
        </div>
      </div>
      {editing ? (
        <RegenerateForm report={report} onCancel={() => setEditing(false)} onDone={() => setEditing(false)} />
      ) : null}
    </li>
  );
}

export default function ReportsPanel({
  campaignId,
  linkedProgramCount,
  onGoToPrograms,
}: {
  campaignId: string;
  linkedProgramCount: number;
  onGoToPrograms: () => void;
}) {
  const { data: reports, isLoading, isError, error, refetch } = useCampaignReports(campaignId);
  const [errorText, setErrorText] = useState<{ for: unknown; msg: string } | null>(null);

  const inFlight = useMemo(
    () => (reports ?? []).filter((r) => REPORT_IN_FLIGHT.has(r.status)),
    [reports],
  );

  useEffect(() => {
    if (!isError) return;
    let active = true;
    void reportErrorMessage(error, 'Could not load reports.').then((msg) => {
      if (active) setErrorText({ for: error, msg });
    });
    return () => {
      active = false;
    };
  }, [isError, error]);

  return (
    <div className="space-y-6">
      {inFlight.map((r) => (
        <InFlightBanner key={r.reportId} report={r} />
      ))}

      <GenerateCard
        campaignId={campaignId}
        linkedProgramCount={linkedProgramCount}
        busy={inFlight.length > 0}
        onGoToPrograms={onGoToPrograms}
      />

      <ZoomSectionCard
        title="Report history"
        description="PDFs are downloaded through Platform. Each report can be regenerated up to its limit."
        action={
          <Button size="sm" variant="ghost" onClick={() => void refetch()}>
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </Button>
        }
      >
        {isLoading ? (
          <ZoomLoadingState label="Loading reports…" />
        ) : isError ? (
          <ZoomAlert tone="error">{errorText?.for === error ? errorText.msg : 'Could not load reports.'}</ZoomAlert>
        ) : !reports || reports.length === 0 ? (
          <ZoomEmptyState
            icon={Link2}
            title="No reports yet"
            body="Generate the first executive report for this campaign above."
          />
        ) : (
          <ul className="-mx-5 -mb-5 divide-y divide-border md:-mx-6 md:-mb-6">
            {reports.map((r) => (
              <ReportRow key={r.reportId} report={r} blocked={inFlight.length > 0} />
            ))}
          </ul>
        )}
      </ZoomSectionCard>
    </div>
  );
}
