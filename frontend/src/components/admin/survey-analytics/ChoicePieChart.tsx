import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';

import type { SurveyChoiceOptionCount } from '../../../api/admin';
import { seriesColor } from './chartTheme';
import { choicePieHeightPx } from './chartSizing';

interface ChoicePieChartProps {
  options: SurveyChoiceOptionCount[];
}

function PieTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: ReadonlyArray<{ payload?: SurveyChoiceOptionCount }>;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const point = payload[0]?.payload;
  if (!point) return null;
  return (
    <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 shadow-lg">
      <p className="text-xs font-semibold text-gray-900">{point.label}</p>
      <p className="font-mono text-sm font-bold tabular-nums text-gray-700">
        {point.count.toLocaleString()}{' '}
        <span className="font-sans font-normal text-gray-500">
          ({point.percentage.toFixed(0)}%)
        </span>
      </p>
    </div>
  );
}

/**
 * Donut chart for single-select choice distributions (parts of a whole).
 * Slice colors are index-stable so they line up with the legend rendered by
 * the surrounding question card. Zero-count options contribute no slice.
 */
export function ChoicePieChart({ options }: ChoicePieChartProps) {
  const total = options.reduce((sum, o) => sum + o.count, 0);
  if (options.length === 0 || total === 0) {
    return <p className="py-6 text-center text-sm text-gray-500">No answers recorded.</p>;
  }

  // Zero-count options contribute no visible slice (Recharts omits them).
  const nonZeroSlices = options.filter((o) => o.count > 0).length;
  const height = choicePieHeightPx(nonZeroSlices);
  const slices = options
    .map((option, colorIndex) => ({ ...option, colorIndex }))
    .filter((option) => option.count > 0);

  return (
    <div
      style={{ height }}
      className="w-full"
      data-testid="choice-pie-chart"
      data-nonzero-slices={nonZeroSlices}
    >
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={slices}
            dataKey="count"
            nameKey="label"
            innerRadius="55%"
            outerRadius="80%"
            paddingAngle={0}
            stroke="#fff"
            strokeWidth={1}
            isAnimationActive
            animationDuration={600}
          >
            {slices.map((entry) => (
              <Cell key={entry.label} fill={seriesColor(entry.colorIndex)} />
            ))}
          </Pie>
          <Tooltip content={<PieTooltip />} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
