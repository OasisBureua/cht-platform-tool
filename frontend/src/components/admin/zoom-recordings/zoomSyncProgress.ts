import type { ZoomSyncJobProgress } from '../../../api/admin';

/** Label + percent for catalog Sync banner. Tolerates old jobs without users/windows. */
export function zoomSyncProgressDisplay(
  progress: ZoomSyncJobProgress | null | undefined,
): { pct: number | null; label: string | undefined } {
  if (!progress) return { pct: null, label: undefined };

  const usersTotal = progress.usersTotal ?? 0;
  const usersDone = progress.usersDone ?? 0;
  const windowsTotal = progress.windowsTotal ?? 0;
  const windowsDone = progress.windowsDone ?? 0;
  const monthsTotal = progress.monthsTotal ?? 0;
  const monthsDone = progress.monthsDone ?? 0;

  const hostPart =
    usersTotal > 0 ? `${usersDone}/${usersTotal} hosts` : null;
  const monthPart =
    monthsTotal > 0 ? `${monthsDone}/${monthsTotal} months` : null;

  if (windowsTotal > 0) {
    const pct = Math.round((windowsDone / windowsTotal) * 100);
    // monthsDone resets per host in the nested loop, so it oscillates.
    // Prefer windows (true work units) when hosts are in play.
    const parts =
      usersTotal > 0
        ? [hostPart, `${windowsDone}/${windowsTotal} windows`]
        : [hostPart, monthPart].filter(Boolean);
    return {
      pct,
      label: `${parts.join(' · ') || `${windowsDone}/${windowsTotal} windows`} (${pct}%)`,
    };
  }

  if (usersTotal > 0) {
    const pct = Math.round((usersDone / usersTotal) * 100);
    const parts = [hostPart, monthPart].filter(Boolean);
    return { pct, label: `${parts.join(' · ')} (${pct}%)` };
  }

  if (monthsTotal > 0) {
    const pct = Math.round((monthsDone / monthsTotal) * 100);
    return { pct, label: `${monthPart} (${pct}%)` };
  }

  return { pct: null, label: undefined };
}
