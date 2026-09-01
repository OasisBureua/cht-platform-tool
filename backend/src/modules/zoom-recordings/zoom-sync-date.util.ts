/** UTC calendar date as YYYY-MM-DD (Zoom account recordings API). */
export function formatZoomApiDate(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function parseZoomApiDate(value: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) {
    throw new Error(`Invalid Zoom API date (expected YYYY-MM-DD): ${value}`);
  }
  return new Date(
    Date.UTC(
      Number.parseInt(match[1], 10),
      Number.parseInt(match[2], 10) - 1,
      Number.parseInt(match[3], 10),
    ),
  );
}

/** Inclusive UTC day range for manual Sync (default monthsBack from config). */
export function syncWindowFromMonthsBack(
  monthsBack: number,
  now: Date = new Date(),
): { fromDate: Date; toDate: Date } {
  const clamped = Math.min(Math.max(monthsBack, 1), 120);
  const toDate = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  const fromDate = new Date(toDate);
  fromDate.setUTCMonth(fromDate.getUTCMonth() - clamped);
  return { fromDate, toDate };
}

/**
 * Split an inclusive date range into ≤1-month windows for
 * GET /accounts/{accountId}/recordings (Zoom max ~31 days per request).
 */
export function buildMonthWindows(
  fromDate: Date,
  toDate: Date,
): Array<{ from: string; to: string }> {
  const start = new Date(
    Date.UTC(fromDate.getUTCFullYear(), fromDate.getUTCMonth(), fromDate.getUTCDate()),
  );
  const end = new Date(
    Date.UTC(toDate.getUTCFullYear(), toDate.getUTCMonth(), toDate.getUTCDate()),
  );
  if (start.getTime() > end.getTime()) return [];

  const windows: Array<{ from: string; to: string }> = [];
  let cursor = start;

  while (cursor.getTime() <= end.getTime()) {
    const monthEnd = new Date(
      Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 0),
    );
    const windowEnd = monthEnd.getTime() < end.getTime() ? monthEnd : end;
    windows.push({
      from: formatZoomApiDate(cursor),
      to: formatZoomApiDate(windowEnd),
    });
    cursor = new Date(
      Date.UTC(
        windowEnd.getUTCFullYear(),
        windowEnd.getUTCMonth(),
        windowEnd.getUTCDate() + 1,
      ),
    );
  }

  return windows;
}
