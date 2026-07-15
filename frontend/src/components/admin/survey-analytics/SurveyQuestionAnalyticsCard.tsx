import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

import type {
  SurveyQuestionAnalytics,
  SurveyRatingQuestionAnalytics,
  SurveyTextQuestionAnalytics,
} from '../../../api/admin';
import { ChoiceDistributionChart } from './ChoiceDistributionChart';
import { RatingHistogram } from './RatingHistogram';

function CardShell({
  prompt,
  subtitle,
  badge,
  children,
}: {
  prompt: string;
  subtitle: string;
  badge?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-4">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
        <h3 className="text-sm font-semibold text-gray-900">{prompt}</h3>
        {badge ? (
          <span className="inline-block shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-gray-600">
            {badge}
          </span>
        ) : null}
      </div>
      <p className="mt-0.5 text-xs text-gray-500">{subtitle}</p>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function RatingStats({ q }: { q: SurveyRatingQuestionAnalytics }) {
  const fmt = (n: number | null) => (n == null ? '—' : Number.isInteger(n) ? String(n) : n.toFixed(1));
  const stats: Array<{ label: string; value: string }> = [
    { label: 'Mean', value: fmt(q.mean) },
    { label: 'Median', value: fmt(q.median) },
    { label: 'Min', value: fmt(q.min) },
    { label: 'Max', value: fmt(q.max) },
  ];
  return (
    <div className="mb-3 grid grid-cols-4 gap-2">
      {stats.map((s) => (
        <div key={s.label} className="rounded-lg bg-gray-50 px-2 py-1.5 text-center">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
            {s.label}
          </p>
          <p className="text-sm font-bold tabular-nums text-gray-900">{s.value}</p>
        </div>
      ))}
    </div>
  );
}

function TextSamples({ q }: { q: SurveyTextQuestionAnalytics }) {
  const [open, setOpen] = useState(false);
  const hasSamples = q.samples.length > 0;
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-700 hover:text-gray-900"
        aria-expanded={open}
      >
        {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        {open ? 'Hide sample responses' : 'View sample responses'}
      </button>
      {open ? (
        hasSamples ? (
          <ul className="mt-2 space-y-2">
            {q.samples.map((sample, i) => (
              <li
                key={i}
                className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 text-sm text-gray-700"
              >
                {sample}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-gray-500">
            No sample responses available. Free-text samples are redacted and shown only on
            request.
          </p>
        )
      ) : null}
    </div>
  );
}

export function SurveyQuestionAnalyticsCard({
  question,
}: {
  question: SurveyQuestionAnalytics;
}) {
  if (question.kind === 'choice') {
    const badge = question.multiSelect ? 'Multi-select' : 'Single-select';
    return (
      <CardShell
        prompt={question.prompt}
        subtitle={`${question.totalAnswered.toLocaleString()} answered`}
        badge={badge}
      >
        <ChoiceDistributionChart options={question.options} multiSelect={question.multiSelect} />
        <ul className="mt-2 space-y-1">
          {question.options.map((o) => (
            <li key={o.label} className="flex items-center justify-between text-xs text-gray-600">
              <span className="truncate pr-2">{o.label}</span>
              <span className="shrink-0 font-mono tabular-nums text-gray-500">
                {o.count.toLocaleString()} · {o.percentage.toFixed(0)}%
              </span>
            </li>
          ))}
        </ul>
      </CardShell>
    );
  }

  if (question.kind === 'rating') {
    return (
      <CardShell
        prompt={question.prompt}
        subtitle={`${question.count.toLocaleString()} answered`}
        badge="Rating"
      >
        <RatingStats q={question} />
        <RatingHistogram histogram={question.histogram} />
      </CardShell>
    );
  }

  return (
    <CardShell
      prompt={question.prompt}
      subtitle={`${question.responseCount.toLocaleString()} responses`}
      badge="Free text"
    >
      <TextSamples q={question} />
    </CardShell>
  );
}
