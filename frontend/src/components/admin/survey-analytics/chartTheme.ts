// Chart strokes/fills are literal brand hexes — SVG attributes can't resolve
// the hsl(var(--x)) design tokens. Matches RxTrendChart so survey-analytics
// charts read as part of the same admin chart family.
export const TEAL = '#3da4c0'; // primary-500
export const ORANGE = '#e7764f'; // accent-500
export const MUTED = '#79869a';

/** Rotating palette for grouped/segmented series and pie slices. */
export const SERIES_COLORS = [TEAL, ORANGE, '#7c9a3b', '#9b6ad1', '#d1a13a', '#5b8def'];

/** Stable slice/series color for a given index (wraps around the palette). */
export function seriesColor(index: number): string {
  return SERIES_COLORS[index % SERIES_COLORS.length];
}
