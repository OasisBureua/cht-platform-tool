import type { SurveyBetaInsights } from '../../../api/admin';

const STAGE_LABELS: Record<string, string> = {
  access: 'Platform access',
  registration: 'Registration',
  livestream: 'Livestream',
  honorarium: 'Honorarium',
};

function stageLabel(stage: string): string {
  return STAGE_LABELS[stage] ?? stage;
}

export function SurveyBetaInsightsPanel({
  insights,
}: {
  insights: SurveyBetaInsights;
}) {
  const { easeByStage, nps, comments } = insights;

  return (
    <section
      className="space-y-4 rounded-card border border-border bg-card p-4"
      data-testid="survey-beta-insights"
      data-print-section="beta-insights"
    >
      <div>
        <h3 className="text-sm font-semibold text-foreground">
          HCP Beta insights
        </h3>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Stage ease averages (1–5), Net Promoter Score, and free-text comments.
        </p>
      </div>

      {easeByStage.length > 0 ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {easeByStage.map((row) => (
            <div
              key={row.questionId}
              className="rounded-[6px] border border-border bg-muted/40 px-3 py-3"
            >
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {stageLabel(row.stage)} ease
              </p>
              <p className="mt-1 text-2xl font-bold tabular-nums text-foreground">
                {row.average != null ? row.average.toFixed(2) : '—'}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {row.count} rated response{row.count === 1 ? '' : 's'}
              </p>
            </div>
          ))}
        </div>
      ) : null}

      {nps ? (
        <div className="rounded-[6px] border border-border bg-muted/40 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Net Promoter Score
          </p>
          <div className="mt-2 flex flex-wrap items-end gap-6">
            <div>
              <p className="text-3xl font-bold tabular-nums text-foreground">
                {nps.score != null ? nps.score : '—'}
              </p>
              <p className="text-xs text-muted-foreground">
                % promoters − % detractors
              </p>
            </div>
            <dl className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <dt className="text-xs text-muted-foreground">Promoters (9–10)</dt>
                <dd className="font-semibold tabular-nums text-foreground">
                  {nps.promoters}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Passives (7–8)</dt>
                <dd className="font-semibold tabular-nums text-foreground">
                  {nps.passives}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Detractors (0–6)</dt>
                <dd className="font-semibold tabular-nums text-foreground">
                  {nps.detractors}
                </dd>
              </div>
            </dl>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {nps.totalRated} rated response{nps.totalRated === 1 ? '' : 's'}
          </p>
        </div>
      ) : null}

      {comments.length > 0 ? (
        <div>
          <h4 className="text-sm font-semibold text-foreground">Comments</h4>
          <ul className="mt-2 divide-y divide-border rounded-[6px] border border-border">
            {comments.map((c, i) => (
              <li key={`${c.responseId ?? 'c'}-${i}`} className="px-3 py-3 text-sm">
                <p className="whitespace-pre-wrap text-foreground">{c.text}</p>
                {c.stageTags && c.stageTags.length > 0 ? (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {c.stageTags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-[6px] bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground"
                      >
                        {stageLabel(tag)}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Untagged — open the Responses tab to tag by stage.
                  </p>
                )}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
