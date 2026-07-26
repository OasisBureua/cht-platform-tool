import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

import { SurveyAnalyticsView } from '../../../components/admin/survey-analytics/SurveyAnalyticsView';
import type { SurveyAnalytics } from '../../../api/admin';

// jsdom has no layout, so recharts' ResponsiveContainer measures 0x0 and spams
// "width/height should be greater than 0" warnings. Give the child chart fixed
// dimensions so it renders quietly.
vi.mock('recharts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('recharts')>();
  const React = await import('react');
  return {
    ...actual,
    ResponsiveContainer: ({ children }: { children: React.ReactElement }) =>
      React.cloneElement(children, { width: 800, height: 300 }),
  };
});

function baseAnalytics(overrides: Partial<SurveyAnalytics['analytics']> = {}): SurveyAnalytics {
  return {
    survey: { id: 'sv1', title: 'Post-event feedback', type: 'FEEDBACK', program: null },
    analytics: {
      surveyType: 'FEEDBACK',
      hasNativeSchema: true,
      totals: {
        totalResponses: 3,
        uniqueRespondents: 3,
        firstResponseAt: '2026-07-10T00:00:00.000Z',
        lastResponseAt: '2026-07-11T00:00:00.000Z',
        completionRate: { eligible: 5, completed: 3, rate: 60 },
        score: null,
      },
      timeSeries: [
        { date: '2026-07-10', count: 1 },
        { date: '2026-07-11', count: 2 },
      ],
      questions: [
        {
          id: 'q1',
          prompt: 'How satisfied were you?',
          type: 'single_choice',
          kind: 'choice',
          multiSelect: false,
          totalAnswered: 3,
          options: [
            { label: 'Very satisfied', count: 2, percentage: 66.67 },
            { label: 'Somewhat satisfied', count: 1, percentage: 33.33 },
          ],
        },
        {
          id: 'q2',
          prompt: 'Rate the event',
          type: 'rating',
          kind: 'rating',
          count: 3,
          mean: 4.3,
          median: 4,
          min: 3,
          max: 5,
          histogram: [
            { value: 3, count: 1 },
            { value: 4, count: 1 },
            { value: 5, count: 1 },
          ],
        },
        {
          id: 'q3',
          prompt: 'Any comments?',
          type: 'text',
          kind: 'text',
          responseCount: 2,
          samples: ['Great session', 'Loved it'],
        },
      ],
      segments: null,
      ...overrides,
    },
  };
}

describe('SurveyAnalyticsView', () => {
  it('renders distributions, summary cards, and rating stats from a mock payload', () => {
    render(
      <SurveyAnalyticsView
        data={baseAnalytics()}
        segmentBy={null}
        onSegmentChange={vi.fn()}
      />,
    );

    // Summary cards
    expect(screen.getByText('Total responses')).toBeInTheDocument();
    expect(screen.getByText('Completion rate')).toBeInTheDocument();
    expect(screen.getByText('60%')).toBeInTheDocument();

    // Choice distribution legend ("Very satisfied" also appears as a chart axis
    // tick, so assert on the count/percentage line which is legend-only).
    expect(screen.getByText('How satisfied were you?')).toBeInTheDocument();
    expect(screen.getAllByText('Very satisfied').length).toBeGreaterThan(0);
    expect(screen.getByText('2 · 67%')).toBeInTheDocument();

    // Rating stats
    expect(screen.getByText('Rate the event')).toBeInTheDocument();
    expect(screen.getByText('Mean')).toBeInTheDocument();
    expect(screen.getByText('4.3')).toBeInTheDocument();
  });

  it('defaults single-select choice to a pie chart and can toggle to bar', () => {
    render(
      <SurveyAnalyticsView
        data={baseAnalytics()}
        segmentBy={null}
        onSegmentChange={vi.fn()}
      />,
    );

    // Single-select question renders the donut by default
    expect(screen.getByTestId('choice-pie-chart')).toBeInTheDocument();
    expect(screen.queryByTestId('choice-distribution-chart')).not.toBeInTheDocument();

    // Toggle to the bar view
    fireEvent.click(screen.getByRole('button', { name: /bar/i }));
    expect(screen.getByTestId('choice-distribution-chart')).toBeInTheDocument();
    expect(screen.queryByTestId('choice-pie-chart')).not.toBeInTheDocument();
  });

  it('reveals PII-safe free-text samples only when expanded', () => {
    render(
      <SurveyAnalyticsView
        data={baseAnalytics()}
        segmentBy={null}
        onSegmentChange={vi.fn()}
      />,
    );

    expect(screen.queryByText('Great session')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /view sample responses/i }));
    expect(screen.getByText('Great session')).toBeInTheDocument();
    expect(screen.getByText('Loved it')).toBeInTheDocument();
  });

  it('shows an empty state when there are no responses', () => {
    const data = baseAnalytics({
      totals: {
        totalResponses: 0,
        uniqueRespondents: 0,
        firstResponseAt: null,
        lastResponseAt: null,
        completionRate: null,
        score: null,
      },
      timeSeries: [],
      questions: [],
    });

    render(
      <SurveyAnalyticsView data={data} segmentBy={null} onSegmentChange={vi.fn()} />,
    );

    expect(screen.getByText('No responses yet')).toBeInTheDocument();
    expect(screen.queryByText('Total responses')).not.toBeInTheDocument();
  });

  it('shows the Jotform notice and hides per-question charts for schema-less surveys', () => {
    const data = baseAnalytics({ hasNativeSchema: false });

    render(
      <SurveyAnalyticsView data={data} segmentBy={null} onSegmentChange={vi.fn()} />,
    );

    // Totals + trend still render
    expect(screen.getByText('Total responses')).toBeInTheDocument();
    // Graceful "not available" notice, and no question distributions
    expect(screen.getByText(/Per-question analytics/i)).toBeInTheDocument();
    expect(screen.queryByText('How satisfied were you?')).not.toBeInTheDocument();
  });

  it('renders per-segment groups when a segment breakdown is present', () => {
    const data = baseAnalytics({
      segments: {
        dimension: 'status',
        groups: [
          {
            key: 'APPROVED',
            label: 'APPROVED',
            totalResponses: 2,
            questions: [
              {
                id: 'q1',
                prompt: 'How satisfied were you?',
                type: 'single_choice',
                kind: 'choice',
                multiSelect: false,
                totalAnswered: 2,
                options: [{ label: 'Very satisfied', count: 2, percentage: 100 }],
              },
            ],
          },
        ],
      },
    });

    render(
      <SurveyAnalyticsView data={data} segmentBy="status" onSegmentChange={vi.fn()} />,
    );

    // Prettified status label from the segment group
    expect(screen.getByText('Approved')).toBeInTheDocument();
    expect(screen.getByText('2 responses')).toBeInTheDocument();
  });
});
