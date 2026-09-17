import { surveyAnswersToRows } from '../../utils/admin-survey-display';

export function SurveyAnswersTable(props: {
  answers: unknown;
  questionsSchema?: unknown;
  compact?: boolean;
}) {
  const { answers, questionsSchema, compact } = props;
  const rows = surveyAnswersToRows(answers, questionsSchema);
  if (rows.length === 0) {
    return <span className="text-muted-foreground">—</span>;
  }

  return (
    <dl>
      {rows.map((row, index) => {
        const empty = row.value === '-' || row.value === '';
        return (
          <div
            key={`${row.label}-${index}`}
            className={[
              'grid gap-1 border-border/50 first:pt-0 last:pb-0 sm:grid-cols-[minmax(10rem,34%)_1fr] sm:gap-x-6',
              index > 0 ? 'border-t' : '',
              compact ? 'py-2.5' : 'py-3.5',
            ].join(' ')}
          >
            <dt
              className={[
                'text-muted-foreground',
                compact ? 'text-xs leading-5' : 'text-sm leading-6',
              ].join(' ')}
            >
              {!compact ? (
                <span className="me-2 inline-block w-4 tabular-nums text-[11px] text-muted-foreground/60">
                  {index + 1}
                </span>
              ) : null}
              {row.label}
            </dt>
            <dd
              className={[
                'whitespace-pre-wrap break-words',
                empty ? 'text-muted-foreground/70' : 'text-foreground',
                compact ? 'text-xs font-medium leading-5' : 'text-sm font-medium leading-6',
              ].join(' ')}
            >
              {empty ? '—' : row.value}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}
