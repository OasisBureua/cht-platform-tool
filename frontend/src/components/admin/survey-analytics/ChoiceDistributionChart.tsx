import {
  Bar,
  BarChart,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import type { SurveyChoiceOptionCount } from '../../../api/admin';
import { MUTED, TEAL } from './chartTheme';

interface ChoiceDistributionChartProps {
  options: SurveyChoiceOptionCount[];
  /** Multi-select percentages can sum above 100; label the axis accordingly. */
  multiSelect?: boolean;
}

function truncate(label: string, max = 32): string {
  return label.length > max ? `${label.slice(0, max - 1)}\u2026` : label;
}

function ChoiceTooltip({
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
    <div className="rounded-[6px] border border-border bg-card px-3 py-2 shadow-lg">
      <p className="text-xs font-semibold text-foreground">{point.label}</p>
      <p className="font-mono text-sm font-bold tabular-nums text-muted-foreground">
        {point.count.toLocaleString()}{' '}
        <span className="font-sans font-normal text-muted-foreground">
          ({point.percentage.toFixed(0)}%)
        </span>
      </p>
    </div>
  );
}

/**
 * Horizontal bar chart of choice-option counts. Bar length encodes the raw
 * count; the trailing label shows the percentage of respondents who picked it.
 */
export function ChoiceDistributionChart({ options }: ChoiceDistributionChartProps) {
  if (options.length === 0) {
    return <p className="py-6 text-center text-sm text-muted-foreground">No answers recorded.</p>;
  }

  const data = options.map((o) => ({ ...o, shortLabel: truncate(o.label) }));
  // Give each row breathing room; clamp so a 2-option question isn't squashed.
  const height = Math.max(120, data.length * 44);

  return (
    <div
      style={{ height }}
      className="w-full"
      data-testid="choice-distribution-chart"
      data-option-count={data.length}
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 4, right: 44, bottom: 4, left: 8 }}
          barCategoryGap={10}
        >
          <XAxis type="number" hide allowDecimals={false} />
          <YAxis
            type="category"
            dataKey="shortLabel"
            width={140}
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 11, fill: MUTED }}
          />
          <Tooltip cursor={{ fill: 'rgba(61,164,192,0.08)' }} content={<ChoiceTooltip />} />
          <Bar dataKey="count" radius={[0, 4, 4, 0]} isAnimationActive={false}>
            {data.map((entry) => (
              <Cell key={entry.label} fill={TEAL} />
            ))}
            <LabelList
              dataKey="percentage"
              position="right"
              formatter={(value: number) => `${value.toFixed(0)}%`}
              style={{ fontSize: 11, fill: MUTED, fontWeight: 600 }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
