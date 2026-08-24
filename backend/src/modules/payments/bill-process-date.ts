/**
 * Bill.com processDate helpers.
 *
 * For BANK_ACCOUNT funding, omit processDate and Bill sets the next US business
 * day (weekends + bank holidays). New vendor bank accounts may require two
 * business days (BDC_1402); then we send an explicit weekday date.
 */

export function isBillProcessDateRetryable(error: unknown): boolean {
  const text = error instanceof Error ? error.message : String(error);
  return (
    text.includes('BDC_1402') ||
    text.includes('BDC_1152') ||
    /process date/i.test(text)
  );
}

/** Next calendar weekday (Mon–Fri) in UTC. Holidays stay Bill's problem. */
export function nextUsWeekdayIsoDate(from: Date = new Date()): string {
  const d = new Date(
    Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()),
  );
  do {
    d.setUTCDate(d.getUTCDate() + 1);
  } while (d.getUTCDay() === 0 || d.getUTCDay() === 6);
  return d.toISOString().slice(0, 10);
}

type BillErrorItem = {
  code?: string;
  message?: string;
};

function parseBillErrorItems(raw: string): BillErrorItem[] {
  const jsonStart = raw.indexOf('[');
  const jsonObjStart = raw.indexOf('{');
  const start =
    jsonStart >= 0 && (jsonObjStart < 0 || jsonStart < jsonObjStart)
      ? jsonStart
      : jsonObjStart;
  if (start < 0) return [];
  try {
    const parsed: unknown = JSON.parse(raw.slice(start));
    const items = Array.isArray(parsed) ? parsed : [parsed];
    return items.filter(
      (item): item is BillErrorItem =>
        !!item && typeof item === 'object' && !Array.isArray(item),
    );
  } catch {
    return [];
  }
}

function cleanBillMessage(message: string): string {
  return message
    .replace(/:\s*\$\{paramName\d+\}/g, '')
    .replace(/\s+\./g, '.')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Short admin-facing line from a Bill.com API error. Full JSON stays in logs.
 */
export function summarizeBillError(error: unknown): string {
  const text = error instanceof Error ? error.message : String(error);
  const statusMatch = text.match(/Bill\.com API error \((\d+)\):\s*([\s\S]*)/);
  if (!statusMatch) {
    const trimmed = text.trim();
    return trimmed.length > 280 ? `${trimmed.slice(0, 277)}…` : trimmed || 'Bill.com request failed';
  }
  const status = statusMatch[1];
  const body = statusMatch[2].trim();
  const items = parseBillErrorItems(body);
  const parts = items
    .map((item) => {
      const code = typeof item.code === 'string' ? item.code.trim() : '';
      const message =
        typeof item.message === 'string' ? cleanBillMessage(item.message) : '';
      if (code && message) return `${code}: ${message}`;
      return code || message;
    })
    .filter(Boolean);
  const unique = [...new Set(parts)];
  if (unique.length > 0) {
    const byCode = new Map<string, string>();
    for (const part of unique) {
      const [code, ...rest] = part.split(': ');
      if (rest.length === 0) {
        byCode.set(part, part);
        continue;
      }
      const existing = byCode.get(code);
      const message = rest.join(': ');
      if (!existing || message.length < existing.length) {
        byCode.set(code, `${code}: ${message}`);
      }
    }
    return `Bill.com (${status}): ${[...byCode.values()].join('; ')}`;
  }
  if (body && body.length < 200 && !body.startsWith('[')) {
    return `Bill.com (${status}): ${body}`;
  }
  return `Bill.com request failed (${status}). Check server logs for details.`;
}

/** Two weekdays out — Bill's one-time vendor bank verification window. */
export function twoUsWeekdaysOutIsoDate(from: Date = new Date()): string {
  return nextUsWeekdayIsoDate(
    new Date(`${nextUsWeekdayIsoDate(from)}T00:00:00.000Z`),
  );
}
