import { useMemo } from 'react';
import { Info, Inbox, Percent, Star, TrendingUp, Users } from 'lucide-react';

import type {
  SurveyAnalytics,
  SurveyAnalyticsSegmentGroup,
  SurveyBetaInsights,
  SurveyQuestionAnalytics,
  SurveySegmentDimension,
} from '../../../api/admin';
import {
  attendanceStatusLabel,
  registrationStatusLabel,
} from '../../../utils/admin-survey-display';
import { SurveyEmptyState } from '../survey-workspace/SurveyEmptyState';
import { SurveyKpiStrip } from '../survey-workspace/SurveyKpiStrip';
import { SurveyKpiTile } from '../survey-workspace/SurveyKpiTile';
import { SegmentFilter } from './SegmentFilter';
import { SubmissionsTrendChart } from './SubmissionsTrendChart';
import { SurveyAnalyticsSummaryCards } from './SurveyAnalyticsSummaryCards';
import { SurveyBetaInsightsPanel } from './SurveyBetaInsightsPanel';
import { SurveyQuestionAnalyticsCard } from './SurveyQuestionAnalyticsCard';

interface SurveyAnalyticsViewProps {
  data: SurveyAnalytics;
  segmentBy: SurveySegmentDimension | null;
  onSegmentChange: (value: SurveySegmentDimension | null) => void;
  isFetching?: boolean;
  /** SCRUM-291 Results tab: report-studio layout with jump nav. */
  variant?: 'default' | 'studio';
}

function truncatePrompt(prompt: string, max = 42): string {
  const clean = prompt.trim().replace(/\s+/g, ' ');
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max - 1)}…`;
}

function scrollToQuestion(id: string) {
  const el = document.getElementById(`question-${id}`);
  if (!el) return;
  el.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function EmptyState({ studio }: { studio?: boolean }) {
  if (studio) {
    return (
      <SurveyEmptyState
        icon={<Inbox className="h-5 w-5" aria-hidden />}
        title="No responses yet"
        description="Analytics will appear once this survey has submissions. Share the survey link or wait for participants to finish."
      />
    );
  }
  return (
    <div className="flex flex-col items-center gap-2 rounded-card border border-dashed border-border bg-card py-16 text-center">
      <Inbox className="h-8 w-8 text-gray-300" />
      <p className="text-sm font-medium text-muted-foreground">No responses yet</p>
      <p className="text-xs text-muted-foreground">Analytics will appear once this survey has submissions.</p>
    </div>
  );
}

function JotformNotice({ studio }: { studio?: boolean }) {
  return (
    <div
      className={[
        'flex items-start gap-3 rounded-card border border-warning/25 bg-warning/10 p-4',
        studio ? 'shadow-card' : '',
      ].join(' ')}
    >
      <Info className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
      <div>
        <p className="text-sm font-semibold text-amber-900">
          Per-question analytics aren&rsquo;t available for this survey
        </p>
        <p className="mt-0.5 text-sm text-warning">
          Responses were collected through Jotform, which doesn&rsquo;t expose a native question
          schema. Totals and submission trends are still available above; export the CSV for the
          full answer detail.
        </p>
      </div>
    </div>
  );
}

function QuestionList({
  questions,
  studio,
}: {
  questions: SurveyQuestionAnalytics[];
  studio?: boolean;
}) {
  if (questions.length === 0) {
    return (
      <p className="rounded-card border border-border bg-card px-4 py-6 text-center text-sm text-muted-foreground">
        No question-level data for this survey.
      </p>
    );
  }
  return (
    <div
      className={
        studio
          ? 'grid grid-cols-1 gap-4'
          : 'grid grid-cols-1 gap-4 lg:grid-cols-2'
      }
    >
      {questions.map((q) => (
        <SurveyQuestionAnalyticsCard key={q.id} question={q} />
      ))}
    </div>
  );
}

function JumpToQuestionNav({ questions }: { questions: SurveyQuestionAnalytics[] }) {
  if (questions.length === 0) return null;

  return (
    <nav
      aria-label="Jump to question"
      data-print-hide
      className="rounded-card border border-border bg-card/90 p-3 shadow-card backdrop-blur-sm lg:sticky lg:top-24 lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto"
    >
      <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
        Jump to question
      </p>
      <ol className="hidden space-y-1 lg:block">
        {questions.map((q, i) => (
          <li key={q.id}>
            <button
              type="button"
              onClick={() => scrollToQuestion(q.id)}
              className="flex w-full items-start gap-2 rounded-[6px] px-2 py-1.5 text-left text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <span className="mt-0.5 font-mono text-[10px] tabular-nums text-muted-foreground/80">
                {String(i + 1).padStart(2, '0')}
              </span>
              <span className="min-w-0 leading-snug">{truncatePrompt(q.prompt)}</span>
            </button>
          </li>
        ))}
      </ol>
      <div className="flex gap-2 overflow-x-auto pb-1 lg:hidden">
        {questions.map((q, i) => (
          <button
            key={q.id}
            type="button"
            onClick={() => scrollToQuestion(q.id)}
            className="shrink-0 rounded-lg border border-border bg-muted/50 px-2.5 py-1.5 text-xs font-semibold text-muted-foreground hover:border-brand-200 hover:text-foreground"
          >
            Q{i + 1}
          </button>
        ))}
      </div>
    </nav>
  );
}

function averageEase(insights: SurveyBetaInsights | null | undefined): number | null {
  if (!insights?.easeByStage?.length) return null;
  const rated = insights.easeByStage.filter((r) => r.average != null && r.count > 0);
  if (rated.length === 0) return null;
  const sum = rated.reduce((acc, r) => acc + (r.average as number), 0);
  return sum / rated.length;
}

function StudioReportStrip({
  totals,
  betaInsights,
}: {
  totals: SurveyAnalytics['analytics']['totals'];
  betaInsights?: SurveyBetaInsights | null;
}) {
  const completion = totals.completionRate;
  const completionValue =
    completion && completion.eligible > 0 ? `${Math.round(completion.rate)}%` : '—';
  const completionHint = completion
    ? `${completion.completed.toLocaleString()} of ${completion.eligible.toLocaleString()} eligible`
    : 'Not applicable';

  const nps = betaInsights?.nps?.score ?? null;
  const easeStages = betaInsights?.easeByStage ?? [];
  const avgEase = easeStages.length === 0 ? averageEase(betaInsights) : null;

  const tileCount =
    2 + (avgEase != null ? 1 : 0) + (betaInsights?.nps ? 1 : 0) + easeStages.length;
  const cols =
    tileCount >= 5
      ? 'lg:grid-cols-3 xl:grid-cols-5'
      : tileCount === 4
        ? 'lg:grid-cols-4'
        : 'lg:grid-cols-3';

  return (
    <div data-testid="survey-report-strip" data-print-section="summary">
      <SurveyKpiStrip className={cols}>
        <SurveyKpiTile
          label="Responses"
          value={totals.totalResponses.toLocaleString()}
          hint={`${totals.uniqueRespondents.toLocaleString()} unique`}
          icon={<Users className="h-4 w-4" aria-hidden />}
          tone="brand"
        />
        <SurveyKpiTile
          label="Completion rate"
          value={completionValue}
          hint={completionHint}
          icon={<Percent className="h-4 w-4" aria-hidden />}
          tone="cyan"
        />
        {easeStages.map((row) => (
          <SurveyKpiTile
            key={row.questionId}
            label={`${row.stage.charAt(0).toUpperCase()}${row.stage.slice(1)} ease`}
            value={row.average != null ? row.average.toFixed(2) : '—'}
            hint={`${row.count} rated · 1–5`}
            icon={<Star className="h-4 w-4" aria-hidden />}
            tone="amber"
          />
        ))}
        {avgEase != null ? (
          <SurveyKpiTile
            label="Avg ease"
            value={avgEase.toFixed(2)}
            hint="Across rated stages (1–5)"
            icon={<Star className="h-4 w-4" aria-hidden />}
            tone="amber"
          />
        ) : null}
        {betaInsights?.nps ? (
          <SurveyKpiTile
            label="NPS"
            value={nps != null ? String(nps) : '—'}
            hint={`${betaInsights.nps.totalRated} rated · promoters − detractors`}
            icon={<TrendingUp className="h-4 w-4" aria-hidden />}
            tone={nps != null && nps < 0 ? 'rose' : 'slate'}
          />
        ) : null}
      </SurveyKpiStrip>
    </div>
  );
}

function segmentGroupLabel(
  dimension: SurveySegmentDimension,
  group: SurveyAnalyticsSegmentGroup,
): string {
  if (group.key === 'unknown') return group.label;
  if (dimension === 'status') return registrationStatusLabel(group.key);
  if (dimension === 'attendance') return attendanceStatusLabel(group.key);
  return group.label;
}

export function SurveyAnalyticsView({
  data,
  segmentBy,
  onSegmentChange,
  isFetching,
  variant = 'default',
}: SurveyAnalyticsViewProps) {
  const studio = variant === 'studio';
  const { analytics } = data;
  const hasResponses = analytics.totals.totalResponses > 0;

  const jumpQuestions = useMemo(() => {
    if (segmentBy && analytics.segments) {
      return analytics.segments.groups.flatMap((g) => g.questions);
    }
    return analytics.questions;
  }, [analytics.questions, analytics.segments, segmentBy]);

  const questionsBody = !analytics.hasNativeSchema ? (
    <JotformNotice studio={studio} />
  ) : segmentBy && analytics.segments ? (
    <div className="space-y-6" data-print-section="questions">
      <h2
        data-print-only
        hidden
        className="text-sm font-semibold uppercase tracking-wide text-gray-500"
      >
        Results by segment
      </h2>
      {analytics.segments.groups.map((group) => (
        <div key={group.key} className="space-y-3">
          <div className="flex items-baseline gap-2">
            <h3 className="text-sm font-semibold text-foreground">
              {segmentGroupLabel(analytics.segments!.dimension, group)}
            </h3>
            <span className="text-xs text-muted-foreground">
              {group.totalResponses.toLocaleString()} responses
            </span>
          </div>
          <QuestionList questions={group.questions} studio={studio} />
        </div>
      ))}
    </div>
  ) : (
    <div data-print-section="questions">
      <h2
        data-print-only
        hidden
        className="text-sm font-semibold uppercase tracking-wide text-gray-500"
      >
        Question results
      </h2>
      <QuestionList questions={analytics.questions} studio={studio} />
    </div>
  );

  return (
    <div
      className="space-y-6"
      data-testid="survey-analytics-view"
      data-variant={variant}
    >
      <div
        className="flex items-center justify-between gap-3"
        data-print-hide="true"
      >
        <p className="text-xs text-muted-foreground">{isFetching ? 'Updating\u2026' : '\u00a0'}</p>
        <SegmentFilter value={segmentBy} onChange={onSegmentChange} disabled={!hasResponses} />
      </div>

      {!hasResponses ? (
        <EmptyState studio={studio} />
      ) : studio ? (
        <>
          <StudioReportStrip
            totals={analytics.totals}
            betaInsights={analytics.betaInsights}
          />

          {analytics.betaInsights ? (
            <SurveyBetaInsightsPanel insights={analytics.betaInsights} />
          ) : null}

          <section
            className="rounded-card border border-border bg-card p-4 shadow-card"
            data-print-section="trend"
          >
            <h3 className="text-sm font-semibold text-foreground">Submissions over time</h3>
            <div className="mt-3">
              <SubmissionsTrendChart points={analytics.timeSeries} />
            </div>
          </section>

          {analytics.hasNativeSchema && !segmentBy ? (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(12rem,15rem)_1fr] lg:gap-6">
              <JumpToQuestionNav questions={jumpQuestions} />
              {questionsBody}
            </div>
          ) : (
            questionsBody
          )}
        </>
      ) : (
        <>
          <SurveyAnalyticsSummaryCards totals={analytics.totals} />

          {analytics.betaInsights ? (
            <SurveyBetaInsightsPanel insights={analytics.betaInsights} />
          ) : null}

          <section
            className="rounded-card border border-border bg-card p-4"
            data-print-section="trend"
          >
            <h3 className="text-sm font-semibold text-foreground">Submissions over time</h3>
            <div className="mt-3">
              <SubmissionsTrendChart points={analytics.timeSeries} />
            </div>
          </section>

          {questionsBody}
        </>
      )}
    </div>
  );
}
