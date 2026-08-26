import { Info, Inbox } from 'lucide-react';

import type {
  SurveyAnalytics,
  SurveyAnalyticsSegmentGroup,
  SurveyQuestionAnalytics,
  SurveySegmentDimension,
} from '../../../api/admin';
import {
  attendanceStatusLabel,
  registrationStatusLabel,
} from '../../../utils/admin-survey-display';
import { SegmentFilter } from './SegmentFilter';
import { SubmissionsTrendChart } from './SubmissionsTrendChart';
import { SurveyAnalyticsSummaryCards } from './SurveyAnalyticsSummaryCards';
import { SurveyQuestionAnalyticsCard } from './SurveyQuestionAnalyticsCard';

interface SurveyAnalyticsViewProps {
  data: SurveyAnalytics;
  segmentBy: SurveySegmentDimension | null;
  onSegmentChange: (value: SurveySegmentDimension | null) => void;
  isFetching?: boolean;
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center gap-2 rounded-card border border-dashed border-border bg-card py-16 text-center">
      <Inbox className="h-8 w-8 text-gray-300" />
      <p className="text-sm font-medium text-muted-foreground">No responses yet</p>
      <p className="text-xs text-muted-foreground">Analytics will appear once this survey has submissions.</p>
    </div>
  );
}

function JotformNotice() {
  return (
    <div className="flex items-start gap-3 rounded-card border border-amber-200 bg-amber-50 p-4">
      <Info className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
      <div>
        <p className="text-sm font-semibold text-amber-900">
          Per-question analytics aren&rsquo;t available for this survey
        </p>
        <p className="mt-0.5 text-sm text-amber-800">
          Responses were collected through Jotform, which doesn&rsquo;t expose a native question
          schema. Totals and submission trends are still available above; export the CSV for the
          full answer detail.
        </p>
      </div>
    </div>
  );
}

function QuestionList({ questions }: { questions: SurveyQuestionAnalytics[] }) {
  if (questions.length === 0) {
    return (
      <p className="rounded-card border border-border bg-card px-4 py-6 text-center text-sm text-muted-foreground">
        No question-level data for this survey.
      </p>
    );
  }
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {questions.map((q) => (
        <SurveyQuestionAnalyticsCard key={q.id} question={q} />
      ))}
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
}: SurveyAnalyticsViewProps) {
  const { analytics } = data;
  const hasResponses = analytics.totals.totalResponses > 0;

  return (
    <div className="space-y-6" data-testid="survey-analytics-view">
      <div
        className="flex items-center justify-between gap-3"
        data-print-hide="true"
      >
        <p className="text-xs text-muted-foreground">{isFetching ? 'Updating\u2026' : '\u00a0'}</p>
        <SegmentFilter value={segmentBy} onChange={onSegmentChange} disabled={!hasResponses} />
      </div>

      {!hasResponses ? (
        <EmptyState />
      ) : (
        <>
          <SurveyAnalyticsSummaryCards totals={analytics.totals} />

          <section className="rounded-card border border-border bg-card p-4">
            <h3 className="text-sm font-semibold text-foreground">Submissions over time</h3>
            <div className="mt-3">
              <SubmissionsTrendChart points={analytics.timeSeries} />
            </div>
          </section>

          {!analytics.hasNativeSchema ? (
            <JotformNotice />
          ) : segmentBy && analytics.segments ? (
            <div className="space-y-6">
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
                  <QuestionList questions={group.questions} />
                </div>
              ))}
            </div>
          ) : (
            <QuestionList questions={analytics.questions} />
          )}
        </>
      )}
    </div>
  );
}
