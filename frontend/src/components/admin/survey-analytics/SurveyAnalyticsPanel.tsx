import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertCircle } from 'lucide-react';

import { adminApi, type SurveySegmentDimension } from '../../../api/admin';
import LoadingSpinner from '../../ui/LoadingSpinner';
import { SurveyEmptyState } from '../survey-workspace/SurveyEmptyState';
import { SurveyAnalyticsView } from './SurveyAnalyticsView';

interface SurveyAnalyticsPanelProps {
  surveyId: string;
  /** When false, the query stays idle (e.g. the Analytics tab isn't open yet). */
  enabled?: boolean;
  /** SCRUM-291 Results tab: report-studio layout with jump nav. */
  variant?: 'default' | 'studio';
}

export function SurveyAnalyticsPanel({
  surveyId,
  enabled = true,
  variant = 'default',
}: SurveyAnalyticsPanelProps) {
  const [segmentBy, setSegmentBy] = useState<SurveySegmentDimension | null>(null);

  const { data, isLoading, isError, isFetching, refetch } = useQuery({
    queryKey: ['admin', 'survey', surveyId, 'analytics', segmentBy],
    // Redacted samples (identity stripped, email/phone masked) power the
    // free-text sample lists; segments are always counts-only server-side.
    queryFn: () =>
      adminApi.getSurveyAnalytics(surveyId, {
        segmentBy: segmentBy ?? undefined,
        includeSamples: true,
      }),
    enabled: enabled && !!surveyId,
  });

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-20">
        <LoadingSpinner />
        {variant === 'studio' ? (
          <p className="text-sm text-muted-foreground">Loading results report…</p>
        ) : null}
      </div>
    );
  }

  if (isError || !data) {
    if (variant === 'studio') {
      return (
        <SurveyEmptyState
          icon={<AlertCircle className="h-5 w-5" aria-hidden />}
          title="Could not load results"
          description="The analytics request failed. Check your connection and try again."
          action={
            <button
              type="button"
              onClick={() => void refetch()}
              className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
            >
              Retry
            </button>
          }
        />
      );
    }
    return (
      <div className="rounded-card border border-destructive/25 bg-destructive/10 p-4 text-destructive">
        Failed to load survey analytics.
      </div>
    );
  }

  return (
    <SurveyAnalyticsView
      data={data}
      segmentBy={segmentBy}
      onSegmentChange={setSegmentBy}
      isFetching={isFetching}
      variant={variant}
    />
  );
}
