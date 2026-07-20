import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import { adminApi, type SurveySegmentDimension } from '../../../api/admin';
import LoadingSpinner from '../../ui/LoadingSpinner';
import { SurveyAnalyticsView } from './SurveyAnalyticsView';

interface SurveyAnalyticsPanelProps {
  surveyId: string;
  /** When false, the query stays idle (e.g. the Analytics tab isn't open yet). */
  enabled?: boolean;
}

export function SurveyAnalyticsPanel({ surveyId, enabled = true }: SurveyAnalyticsPanelProps) {
  const [segmentBy, setSegmentBy] = useState<SurveySegmentDimension | null>(null);

  const { data, isLoading, isError, isFetching } = useQuery({
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
      <div className="flex justify-center py-20">
        <LoadingSpinner />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">
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
    />
  );
}
