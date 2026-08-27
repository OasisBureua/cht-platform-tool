import type { SurveyAnalyticsTotals } from '../../../api/admin';

interface SummaryCardProps {
  label: string;
  value: string;
  hint?: string;
}

function SummaryCard({ label, value, hint }: SummaryCardProps) {
  return (
    <div className="rounded-card border border-border bg-card p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums text-foreground">{value}</p>
      {hint ? <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export function SurveyAnalyticsSummaryCards({ totals }: { totals: SurveyAnalyticsTotals }) {
  const completion = totals.completionRate;
  // API already returns rate as 0–100 (completed/eligible * 100); do not scale again.
  const completionValue =
    completion && completion.eligible > 0 ? `${Math.round(completion.rate)}%` : '-';
  const completionHint = completion
    ? `${completion.completed.toLocaleString()} of ${completion.eligible.toLocaleString()} eligible`
    : 'Not applicable';

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <SummaryCard label="Total responses" value={totals.totalResponses.toLocaleString()} />
      <SummaryCard
        label="Unique respondents"
        value={totals.uniqueRespondents.toLocaleString()}
      />
      <SummaryCard label="Completion rate" value={completionValue} hint={completionHint} />
    </div>
  );
}
