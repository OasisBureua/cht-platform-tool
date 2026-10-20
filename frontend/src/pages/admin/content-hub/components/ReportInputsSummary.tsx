import { useState } from 'react';
import { Link } from 'react-router-dom';
import { format, isValid, parseISO } from 'date-fns';
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronRight, XCircle } from 'lucide-react';
import type { ReportInputs } from '../../../../api/reports';
import {
  describeReportInputs,
  summarizeReportInputs,
  type ReportInputFix,
  type ReportInputRow,
} from '../lib/reportInputs';

const STATUS_ICON: Record<ReportInputRow['status'], { Icon: typeof CheckCircle2; className: string }> = {
  ok: { Icon: CheckCircle2, className: 'text-green-600 dark:text-green-400' },
  missing: { Icon: AlertTriangle, className: 'text-amber-600 dark:text-amber-400' },
  error: { Icon: XCircle, className: 'text-destructive' },
};

const fixLinkClass = 'shrink-0 text-xs font-medium text-brand-600 hover:underline';

function updated(fetchedAt: string | null): string | null {
  if (!fetchedAt) return null;
  const d = parseISO(fetchedAt);
  return isValid(d) ? `updated ${format(d, 'MMM d')}` : null;
}

/**
 * CPR-51 — what Generate will find. One line by default; the details list each
 * source with a link to fill what is missing.
 */
export function ReportInputsSummary({
  campaignId,
  inputs,
  isLoading,
  isError,
  sourceOptions,
  selected,
  autoOff,
  programHubPath,
}: {
  campaignId: string;
  inputs: ReportInputs | undefined;
  isLoading: boolean;
  isError: boolean;
  sourceOptions: Array<{ value: string; label: string }>;
  selected: string[];
  /** Labels of sources turned off because they had no data. */
  autoOff: string[];
  /** Program hub of the only linked program; null when there are none or several. */
  programHubPath: string | null;
}) {
  const [open, setOpen] = useState(false);

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Checking which data is available…</p>;
  }
  if (isError || !inputs) {
    return (
      <p className="text-sm text-muted-foreground">
        Could not check which data is available. You can still generate.
      </p>
    );
  }

  const { withData, total, missing, transcriptsMissing } = summarizeReportInputs(inputs, sourceOptions);
  const rows = describeReportInputs(inputs, sourceOptions);
  const allThere = missing.length === 0 && !transcriptsMissing;
  const Toggle = open ? ChevronDown : ChevronRight;

  const fixLink = (fix: ReportInputFix) => {
    switch (fix) {
      case 'link-programs':
        return (
          <Link to={{ search: '?tab=programs' }} className={fixLinkClass}>
            Link programs
          </Link>
        );
      case 'pull-transcript':
        return programHubPath ? (
          <Link to={programHubPath} className={fixLinkClass}>
            Pull from Zoom
          </Link>
        ) : (
          <Link to={{ search: '?tab=programs' }} className={fixLinkClass}>
            Open programs
          </Link>
        );
      case 'attach-kols':
        return (
          <button
            type="button"
            className={fixLinkClass}
            onClick={() =>
              document.getElementById('campaign-kols')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
            }
          >
            Attach KOLs
          </button>
        );
      case 'sync-hubspot':
        return (
          <Link to={{ search: '?tab=sources' }} className={fixLinkClass}>
            Sync HubSpot
          </Link>
        );
      case 'sync-platform':
        return (
          <Link to={{ search: '?tab=sources' }} className={fixLinkClass}>
            Retry sync
          </Link>
        );
      case 'upload-csv':
        return (
          <Link to={`/admin/reports/campaigns/${campaignId}/upload`} className={fixLinkClass}>
            Upload CSV
          </Link>
        );
    }
  };

  return (
    <div className="rounded-[6px] bg-card shadow-card">
      <button
        type="button"
        className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        {allThere ? (
          <CheckCircle2 className="h-4 w-4 shrink-0 text-green-600 dark:text-green-400" aria-hidden />
        ) : (
          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />
        )}
        <span className="min-w-0 flex-1">
          <span className="font-medium text-foreground">
            {withData} of {total} sources have data
          </span>
          {missing.length > 0 ? (
            <span className="text-muted-foreground"> · missing: {missing.join(', ')}</span>
          ) : null}
          {transcriptsMissing ? (
            <span className="text-muted-foreground"> · transcripts not pulled</span>
          ) : null}
        </span>
        <span className="flex shrink-0 items-center gap-1 text-xs font-medium text-brand-600">
          {open ? 'Hide' : 'Details'}
          <Toggle className="h-3.5 w-3.5" aria-hidden />
        </span>
      </button>

      {autoOff.length > 0 ? (
        <p className="border-t border-border px-4 py-2 text-xs text-muted-foreground">
          Turned off because they have no data: {autoOff.join(', ')}.
        </p>
      ) : null}

      {open ? (
        <div className="border-t border-border">
          <ul className="divide-y divide-border" aria-label="Report inputs">
            {rows.map((row) => {
              const { Icon, className } = STATUS_ICON[row.status];
              const when = updated(row.fetchedAt);
              const off = !selected.includes(row.source);
              return (
                <li key={row.key} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                  <Icon className={`h-4 w-4 shrink-0 ${className}`} aria-label={row.status} />
                  <span className="w-32 shrink-0 font-medium text-foreground">{row.label}</span>
                  <span className="min-w-0 flex-1 text-muted-foreground">
                    {row.detail}
                    {off ? ' · not included' : ''}
                  </span>
                  {row.fix ? fixLink(row.fix) : null}
                  {when ? (
                    <span className="hidden shrink-0 text-xs text-muted-foreground sm:inline">{when}</span>
                  ) : null}
                </li>
              );
            })}
          </ul>
          <p className="border-t border-border px-4 py-2 text-xs text-muted-foreground">
            As of the last sync. Refresh data pulls the latest from Platform.
          </p>
        </div>
      ) : null}
    </div>
  );
}
