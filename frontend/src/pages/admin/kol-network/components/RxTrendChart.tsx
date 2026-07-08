import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import type { RxTrendPoint } from '../lib/intel';

// Chart strokes are literal brand hexes (SVG attributes can't resolve the
// hsl(var(--x)) tokens): teal = primary-500, orange = accent-500.
const TEAL = '#3da4c0';
const ORANGE = '#e7764f';
const MUTED = '#79869a';

function TrendTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: ReadonlyArray<{ value?: number | string; payload?: RxTrendPoint }>;
  label?: string | number;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const point = payload[0]?.payload;
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 shadow-card-hover">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="font-mono text-sm font-bold tabular-nums text-foreground">
        {payload[0]?.value?.toLocaleString()} <span className="font-sans font-normal">claims</span>
      </p>
      {point?.chmShoot && (
        <p className="mt-0.5 text-[10px] font-semibold text-accent-600 dark:text-accent-400">
          first CHM shoot
        </p>
      )}
    </div>
  );
}

/**
 * "Rx · pre / post first CHM shoot" attribution chart — evilcharts-style
 * AreaChart: smooth teal monotone line with a fade-to-transparent gradient
 * fill and a subtle glow, orange dashed reference line on the first-CHM-shoot
 * month, minimal muted axes, animated draw-in.
 */
export function RxTrendChart({ points }: { points: RxTrendPoint[] }) {
  const shootMonth = points.find((p) => p.chmShoot)?.month;
  return (
    <div className="h-44 w-full [&_.recharts-area-curve]:[filter:drop-shadow(0_0_5px_rgba(61,164,192,0.45))]">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={points} margin={{ top: 18, right: 8, bottom: 0, left: -14 }}>
          <defs>
            <linearGradient id="rxTrendFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={TEAL} stopOpacity={0.28} />
              <stop offset="100%" stopColor={TEAL} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid
            vertical={false}
            stroke={MUTED}
            strokeOpacity={0.16}
            strokeDasharray="3 6"
          />
          <XAxis
            dataKey="month"
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 10, fill: MUTED }}
            interval="preserveStartEnd"
            dy={4}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 10, fill: MUTED }}
            tickCount={4}
            width={34}
          />
          <Tooltip
            content={<TrendTooltip />}
            cursor={{ stroke: TEAL, strokeOpacity: 0.25, strokeDasharray: '3 3' }}
          />
          {shootMonth && (
            <ReferenceLine
              x={shootMonth}
              stroke={ORANGE}
              strokeDasharray="4 4"
              strokeWidth={1.5}
              label={{
                value: 'first CHM shoot',
                position: 'top',
                fill: ORANGE,
                fontSize: 10,
                fontWeight: 600,
                dy: -2,
              }}
            />
          )}
          <Area
            type="monotone"
            dataKey="claims"
            stroke={TEAL}
            strokeWidth={2.5}
            fill="url(#rxTrendFill)"
            dot={false}
            activeDot={{ r: 4, fill: TEAL, stroke: '#fff', strokeWidth: 2 }}
            isAnimationActive
            animationDuration={900}
            animationEasing="ease-out"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
