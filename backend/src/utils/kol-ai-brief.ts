import type { PublicKolAiBrief } from '../modules/kol-network/kol-network.types';

/** Mirrors Content Hub `kol_enrichment._parse_brief_sections` section headings. */
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

type BriefSectionKey = 'who_they_are' | 'what_they_focus_on' | 'chm_context';

function mapHeaderToField(header: string): BriefSectionKey | null {
  const h = header.toLowerCase().trim();
  if (h === 'who they are') return 'who_they_are';
  if (h === 'what they focus on' || h === 'focus') return 'what_they_focus_on';
  if (h === 'chm context') return 'chm_context';
  return null;
}

/** Split combined MediaHub markdown on ## section headings. */
export function parseBriefSections(raw: string): PublicKolAiBrief {
  const text = raw.replace(/\r\n/g, '\n').trim();
  if (!text) return {};

  const headers = [...text.matchAll(sectionHeaderRegex())];
  if (headers.length === 0) {
    return { who_they_are: cleanBriefText(text) };
  }

  const out: PublicKolAiBrief = {};
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

/** Normalize Content Hub / legacy ai_brief payloads to structured sections. */
export function normalizePublicKolAiBrief(
  aiBrief?: PublicKolAiBrief | null,
): PublicKolAiBrief | undefined {
  if (!aiBrief) return undefined;

  const whoRaw = aiBrief.who_they_are?.trim() ?? '';
  const focusRaw = aiBrief.what_they_focus_on?.trim() ?? '';
  const chmRaw = aiBrief.chm_context?.trim() ?? '';

  if (!whoRaw && !focusRaw && !chmRaw) return undefined;

  let parsed: PublicKolAiBrief = {};
  if (whoRaw && looksLikeCombinedBrief(whoRaw)) {
    parsed = parseBriefSections(whoRaw);
  } else if (whoRaw) {
    parsed.who_they_are = cleanBriefText(
      whoRaw.replace(SECTION_HEADER_AT_START, ''),
    );
  }

  const normalized: PublicKolAiBrief = {
    who_they_are: parsed.who_they_are || undefined,
    what_they_focus_on: focusRaw || parsed.what_they_focus_on || undefined,
    chm_context: chmRaw || parsed.chm_context || undefined,
  };

  if (
    !normalized.who_they_are &&
    !normalized.what_they_focus_on &&
    !normalized.chm_context
  ) {
    return undefined;
  }

  return normalized;
}
