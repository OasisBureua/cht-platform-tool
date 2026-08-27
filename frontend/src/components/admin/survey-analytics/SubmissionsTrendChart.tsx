import { useMemo } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { format, parseISO } from 'date-fns';

import type { SurveyAnalyticsTimeSeriesPoint } from '../../../api/admin';
import { MUTED, TEAL } from './chartTheme';
import { submissionsTrendHeightPx } from './chartSizing';

interface SubmissionsTrendChartProps {
  points: SurveyAnalyticsTimeSeriesPoint[];
}

function safeFormat(date: string): string {
  try {
    return format(parseISO(date), 'MMM d');
  } catch {
    return date;
  }
}

function TrendTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: ReadonlyArray<{ value?: number | string; payload?: { label: string } }>;
}) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="rounded-[6px] border border-border bg-card px-3 py-2 shadow-lg">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {payload[0]?.payload?.label}
      </p>
      <p className="font-mono text-sm font-bold tabular-nums text-muted-foreground">
        {Number(payload[0]?.value ?? 0).toLocaleString()}{' '}
        <span className="font-sans font-normal text-muted-foreground">submissions</span>
      </p>
    </div>
  );
}

/**
 * Submissions-over-time area chart. Mirrors RxTrendChart's evilcharts-style
 * teal fade so it sits in the same visual family as other admin charts.
 */
export function SubmissionsTrendChart({ points }: SubmissionsTrendChartProps) {
  const data = useMemo(
    () => points.map((p) => ({ ...p, label: safeFormat(p.date) })),
    [points],
  );

  if (data.length === 0) {
    return <p className="py-6 text-center text-sm text-muted-foreground">No submissions yet.</p>;
  }

  const height = submissionsTrendHeightPx(data.length);

  return (
    <div
      style={{ height }}
      className="w-full"
      data-testid="submissions-trend-chart"
      data-point-count={data.length}
    >
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
          <defs>
            <linearGradient id="submissionsTrendFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={TEAL} stopOpacity={0.28} />
              <stop offset="100%" stopColor={TEAL} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke={MUTED} strokeOpacity={0.16} strokeDasharray="3 6" />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 10, fill: MUTED }}
            interval="preserveStartEnd"
            dy={4}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            allowDecimals={false}
            tick={{ fontSize: 10, fill: MUTED }}
            tickCount={4}
            width={34}
          />
          <Tooltip
            content={<TrendTooltip />}
            cursor={{ stroke: TEAL, strokeOpacity: 0.25, strokeDasharray: '3 3' }}
          />
          <Area
            type="monotone"
            dataKey="count"
            stroke={TEAL}
            strokeWidth={2.5}
            fill="url(#submissionsTrendFill)"
            dot={false}
            activeDot={{ r: 4, fill: TEAL, stroke: '#fff', strokeWidth: 2 }}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
