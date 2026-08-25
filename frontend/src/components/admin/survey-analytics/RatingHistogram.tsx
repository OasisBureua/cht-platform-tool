import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import type { SurveyHistogramBucket } from '../../../api/admin';
import { MUTED, TEAL } from './chartTheme';
import { ratingHistogramHeightPx } from './chartSizing';

interface RatingHistogramProps {
  histogram: SurveyHistogramBucket[];
}

function RatingTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: ReadonlyArray<{ value?: number | string }>;
  label?: string | number;
}) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 shadow-lg">
      <p className="text-xs font-semibold text-gray-900">Rating {label}</p>
      <p className="font-mono text-sm font-bold tabular-nums text-gray-700">
        {Number(payload[0]?.value ?? 0).toLocaleString()}{' '}
        <span className="font-sans font-normal text-gray-500">responses</span>
      </p>
    </div>
  );
}

/** Vertical histogram of rating values (1..N) → response counts. */
export function RatingHistogram({ histogram }: RatingHistogramProps) {
  if (histogram.length === 0) {
    return <p className="py-6 text-center text-sm text-gray-500">No ratings recorded.</p>;
  }

  const nonZeroBuckets = histogram.filter((b) => b.count > 0).length;
  const height = ratingHistogramHeightPx(nonZeroBuckets);

  return (
    <div
      style={{ height }}
      className="w-full"
      data-testid="rating-histogram"
      data-nonzero-buckets={nonZeroBuckets}
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={histogram} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
          <CartesianGrid vertical={false} stroke={MUTED} strokeOpacity={0.16} strokeDasharray="3 6" />
          <XAxis
            dataKey="value"
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 11, fill: MUTED }}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            allowDecimals={false}
            tick={{ fontSize: 11, fill: MUTED }}
            width={34}
          />
          <Tooltip cursor={{ fill: 'rgba(61,164,192,0.08)' }} content={<RatingTooltip />} />
          <Bar
            dataKey="count"
            fill={TEAL}
            radius={[4, 4, 0, 0]}
            isAnimationActive
            animationDuration={600}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
