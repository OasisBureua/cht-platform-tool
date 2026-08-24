import {
  FUNNEL_STAGE_KEYS,
  FUNNEL_STAGE_LABELS,
  FUNNEL_STAGE_PEOPLE_AVAILABLE,
  FUNNEL_STAGE_SOURCES,
  type FunnelStageKey,
  type FunnelStageSummary,
} from './campaigns-funnel.types';

/**
 * Drop-off % from previous stage.
 * - null for Aware (no previous) or when previous count is 0
 * - 0 when current >= previous (no drop / growth — HubSpot metrics are not nested cohorts)
 * - otherwise round(((previous - current) / previous) * 100), always >= 0
 */
export function dropOffFromPreviousPct(
  previousCount: number,
  currentCount: number,
): number | null {
  if (previousCount <= 0) return null;
  if (currentCount >= previousCount) return 0;
  return Math.round(((previousCount - currentCount) / previousCount) * 100);
}

export function emptyCountsByStage(): Record<FunnelStageKey, number> {
  return {
    aware: 0,
    engaged: 0,
    captured: 0,
    registered: 0,
    attended: 0,
    converted: 0,
  };
}

export function buildStagesFromCounts(
  counts: Record<FunnelStageKey, number>,
): FunnelStageSummary[] {
  return FUNNEL_STAGE_KEYS.map((key, index) => {
    const previousKey = index > 0 ? FUNNEL_STAGE_KEYS[index - 1] : null;
    const previousCount = previousKey ? counts[previousKey] : 0;
    return {
      key,
      label: FUNNEL_STAGE_LABELS[key],
      count: counts[key],
      dropOffFromPreviousPct: previousKey
        ? dropOffFromPreviousPct(previousCount, counts[key])
        : null,
      source: FUNNEL_STAGE_SOURCES[key],
      peopleAvailable: FUNNEL_STAGE_PEOPLE_AVAILABLE[key],
    };
  });
}

export function toIsoDate(value: string | null | undefined): string | null {
  const raw = value?.trim();
  if (!raw) return null;
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(raw);
  return match?.[1] ?? null;
}

export function defaultReportingWindow(): {
  startDate: string;
  endDate: string;
} {
  const end = new Date();
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - 90);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  return { startDate: fmt(start), endDate: fmt(end) };
}

/** Inclusive UTC day bounds for Prisma date filters. */
export function utcDayBounds(
  startDate: string,
  endDate: string,
): { gte: Date; lte: Date } {
  return {
    gte: new Date(`${startDate}T00:00:00.000Z`),
    lte: new Date(`${endDate}T23:59:59.999Z`),
  };
}

export async function mapPool<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  if (!items.length) return [];
  const results = new Array<R>(items.length);
  let cursor = 0;

  const workers = Array.from(
    { length: Math.min(concurrency, items.length) },
    async () => {
      while (cursor < items.length) {
        const index = cursor++;
        results[index] = await fn(items[index], index);
      }
    },
  );

  await Promise.all(workers);
  return results;
}
