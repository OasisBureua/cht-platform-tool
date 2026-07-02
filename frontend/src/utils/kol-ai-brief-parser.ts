export type ParsedKolAiBrief = {
  whoTheyAre?: string;
  focus?: string;
  chmContext?: string;
};

type AiBriefInput = {
  whoTheyAre?: string | null;
  focus?: string | null;
  chmContext?: string | null;
};

const SECTION_NAMES =
  'who they are|what they focus on|focus|chm context';

function sectionHeaderRegex(flags = 'gi'): RegExp {
  return new RegExp(`#{1,3}\\s*(${SECTION_NAMES})\\s*`, flags);
}

const SECTION_HEADER_AT_START = new RegExp(
  `^#{1,3}\\s*(${SECTION_NAMES})\\s*`,
  'i',
);

function cleanBriefText(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/#{1,6}\s*/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function mapHeaderToField(header: string): keyof ParsedKolAiBrief | null {
  const h = header.toLowerCase().trim();
  if (h === 'who they are') return 'whoTheyAre';
  if (h === 'what they focus on' || h === 'focus') return 'focus';
  if (h === 'chm context') return 'chmContext';
  return null;
}

/** Split a combined markdown blob like `## Who they are … ## What they focus on …`. */
export function parseCombinedAiBrief(raw: string): ParsedKolAiBrief {
  const text = raw.replace(/\r\n/g, '\n').trim();
  if (!text) return {};

  const headers = [...text.matchAll(sectionHeaderRegex())];
  if (headers.length === 0) {
    return { whoTheyAre: cleanBriefText(text) };
  }

  const out: ParsedKolAiBrief = {};
  for (let i = 0; i < headers.length; i++) {
    const match = headers[i];
    const field = mapHeaderToField(match[1]);
    if (!field) continue;

    const bodyStart = match.index! + match[0].length;
    const bodyEnd = i + 1 < headers.length ? headers[i + 1].index! : text.length;
    const body = cleanBriefText(text.slice(bodyStart, bodyEnd));
    if (body) out[field] = body;
  }

  return out;
}

function looksLikeCombinedBrief(text: string): boolean {
  return sectionHeaderRegex('i').test(text);
}

/** Normalize API/static aiBrief — structured fields or a single combined markdown string. */
export function normalizeKolAiBrief(
  aiBrief?: AiBriefInput | null,
): ParsedKolAiBrief | undefined {
  if (!aiBrief) return undefined;

  const whoRaw = aiBrief.whoTheyAre?.trim() ?? '';
  const focusRaw = aiBrief.focus?.trim() ?? '';
  const chmRaw = aiBrief.chmContext?.trim() ?? '';

  let parsed: ParsedKolAiBrief = {};
  if (whoRaw && looksLikeCombinedBrief(whoRaw)) {
    parsed = parseCombinedAiBrief(whoRaw);
  } else if (whoRaw) {
    parsed.whoTheyAre = cleanBriefText(
      whoRaw.replace(SECTION_HEADER_AT_START, ''),
    );
  }

  return {
    whoTheyAre: parsed.whoTheyAre || undefined,
    focus: focusRaw || parsed.focus || undefined,
    chmContext: chmRaw || parsed.chmContext || undefined,
  };
}
