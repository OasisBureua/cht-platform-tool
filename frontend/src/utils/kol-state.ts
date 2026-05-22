import type { PublicKol } from '../api/kol-network';
import type { DolEntry } from '../data/dol-network';
import { US_STATES, normalizeUsStateCode, usStateLabel } from '../data/us-states';

/** MediaHub region slug prefix → US state (slug is geographic, not always 2 letters). */
const REGION_SLUG_PREFIX_TO_STATE: Record<string, string> = {
  al: 'AL',
  ak: 'AK',
  az: 'AZ',
  ar: 'AR',
  ca: 'CA',
  co: 'CO',
  ct: 'CT',
  dc: 'DC',
  de: 'DE',
  fl: 'FL',
  ga: 'GA',
  hi: 'HI',
  id: 'ID',
  il: 'IL',
  in: 'IN',
  ia: 'IA',
  ks: 'KS',
  ky: 'KY',
  la: 'LA',
  me: 'ME',
  md: 'MD',
  ma: 'MA',
  mi: 'MI',
  mn: 'MN',
  ms: 'MS',
  mo: 'MO',
  mt: 'MT',
  ne: 'NE',
  nv: 'NV',
  nh: 'NH',
  nj: 'NJ',
  nm: 'NM',
  ny: 'NY',
  nc: 'NC',
  nd: 'ND',
  oh: 'OH',
  ok: 'OK',
  or: 'OR',
  pa: 'PA',
  ri: 'RI',
  sc: 'SC',
  sd: 'SD',
  tn: 'TN',
  tx: 'TX',
  ut: 'UT',
  vt: 'VT',
  va: 'VA',
  wa: 'WA',
  wv: 'WV',
  wi: 'WI',
  wy: 'WY',
};

const STATE_NAMES_BY_LENGTH = [...US_STATES]
  .filter((s) => s.value)
  .sort((a, b) => b.label.length - a.label.length);

const CITY_STATE_AT_END =
  /,\s*([A-Za-z][A-Za-z\s.']+),\s*([A-Z]{2})\.?(?:\s|$|\)|,)/;
const STATE_ABBREV_AT_END = /,\s*([A-Z]{2})\.?(?:\s|$|\)|,)/;
const STATE_ABBREV_BEFORE_PAREN = /\b([A-Z]{2})\.(?:\s|$)/;

function stateFromRegionLabel(label: string): string | null {
  const trimmed = label.trim();
  if (!trimmed) return null;

  const codePrefix = trimmed.match(/^([A-Za-z]{2})(?:\s|$|[-–—/])/);
  if (codePrefix) {
    const code = normalizeUsStateCode(codePrefix[1]);
    if (code) return code;
  }

  const firstSegment = trimmed.split(/\s*[-–—/]\s*/)[0]?.trim() ?? trimmed;
  return normalizeUsStateCode(firstSegment);
}

function stateFromRegionSlug(slug: string): string | null {
  const s = slug.trim().toLowerCase();
  if (!s) return null;

  const head = s.split('-')[0];
  if (head && REGION_SLUG_PREFIX_TO_STATE[head]) {
    return REGION_SLUG_PREFIX_TO_STATE[head];
  }

  for (const st of STATE_NAMES_BY_LENGTH) {
    const slugName = st.label.toLowerCase().replace(/\s+/g, '-');
    if (s === slugName || s.startsWith(`${slugName}-`) || s.includes(`-${slugName}-`)) {
      return st.value;
    }
  }

  return null;
}

/** Practice site keywords when role text omits ", ST" (e.g. MSK-only lines). */
const AFFILIATION_STATE_HINTS: ReadonlyArray<{ pattern: RegExp; state: string }> = [
  { pattern: /memorial\s+sloan\s+kettering|\bmsk(?:\s+cancer|\s+cc)?\b/i, state: 'NY' },
  { pattern: /weill\s+cornell|cornell\s+medicine.*new\s+york/i, state: 'NY' },
  { pattern: /dana[- ]?farber|harvard.*boston/i, state: 'MA' },
  { pattern: /yale\s+school|smilow|new\s+haven/i, state: 'CT' },
  { pattern: /\bupmc\b|pittsburgh/i, state: 'PA' },
  { pattern: /penn\s+medicine|abramson|philadelphia/i, state: 'PA' },
  { pattern: /northwestern\s+medicine|chicago,\s*il/i, state: 'IL' },
  { pattern: /rush\s+university/i, state: 'IL' },
  { pattern: /university\s+of\s+illinois|ui\s+health/i, state: 'IL' },
  { pattern: /indiana\s+university|hematology\s+oncology\s+of\s+indiana/i, state: 'IN' },
  { pattern: /cleveland\s+clinic/i, state: 'OH' },
  { pattern: /university\s+of\s+kansas|kansas\s+city,\s*ks/i, state: 'KS' },
  { pattern: /avera\s+cancer/i, state: 'SD' },
  { pattern: /washington\s+university|siteman|st\.\s*louis/i, state: 'MO' },
  { pattern: /sarah\s+cannon|nashville/i, state: 'TN' },
  { pattern: /west\s+cancer\s+center|memphis/i, state: 'TN' },
  { pattern: /md\s+anderson|texas\s+oncology|baylor\s+college|ut\s+southwestern|memorial\s+hermann|houston/i, state: 'TX' },
  { pattern: /rocky\s+mountain\s+cancer|denver|lone\s+tree/i, state: 'CO' },
  { pattern: /ucla\s+health|los\s+angeles/i, state: 'CA' },
  { pattern: /stanford\s+(?:medicine|cancer)/i, state: 'CA' },
  { pattern: /city\s+of\s+hope|duarte/i, state: 'CA' },
  { pattern: /providence\s+cancer|portland/i, state: 'OR' },
  { pattern: /swedish\s+cancer|seattle/i, state: 'WA' },
];

function stateFromAffiliationHints(text: string): string | null {
  for (const { pattern, state } of AFFILIATION_STATE_HINTS) {
    if (pattern.test(text)) return state;
  }
  return null;
}

function stateFromFreeText(text: string): string | null {
  const t = text.trim();
  if (!t) return null;

  const cityState = t.match(CITY_STATE_AT_END);
  if (cityState) {
    const code = normalizeUsStateCode(cityState[2]);
    if (code) return code;
  }

  const abbrevEnd = [...t.matchAll(new RegExp(STATE_ABBREV_AT_END.source, 'g'))];
  if (abbrevEnd.length > 0) {
    const last = abbrevEnd[abbrevEnd.length - 1][1];
    const code = normalizeUsStateCode(last);
    if (code) return code;
  }

  const abbrevDot = t.match(STATE_ABBREV_BEFORE_PAREN);
  if (abbrevDot) {
    const code = normalizeUsStateCode(abbrevDot[1]);
    if (code) return code;
  }

  for (const st of STATE_NAMES_BY_LENGTH) {
    const re = new RegExp(`\\b${st.label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    if (re.test(t)) return st.value;
  }

  return null;
}

function stateFromPracticeText(text: string): string | null {
  const fromText = stateFromFreeText(text);
  if (fromText) return fromText;
  return stateFromAffiliationHints(text);
}

/**
 * Derive US state for a KOL from practice location (role, institution, intel) before
 * MediaHub production region — region_label is often a hub default (e.g. New York).
 */
export function deriveKolUsState(
  kol: PublicKol,
  entry?: Pick<DolEntry, 'role' | 'education' | 'intel'>,
): string | null {
  const loc = entry?.intel?.location?.trim();
  if (loc) {
    const fromLoc = stateFromPracticeText(loc) ?? normalizeUsStateCode(loc);
    if (fromLoc) return fromLoc;
  }

  const practiceFields = [
    entry?.role,
    kol.title,
    kol.institution,
    kol.bio,
    kol.specialty,
  ];

  for (const text of practiceFields) {
    if (!text?.trim()) continue;
    const fromPractice = stateFromPracticeText(text);
    if (fromPractice) return fromPractice;
  }

  if (kol.region?.trim()) {
    const fromSlug = stateFromRegionSlug(kol.region);
    if (fromSlug) return fromSlug;
  }

  if (kol.region_label?.trim()) {
    const fromLabel = stateFromRegionLabel(kol.region_label);
    if (fromLabel) return fromLabel;
  }

  if (entry?.education?.trim()) {
    const fromEdu = stateFromFreeText(entry.education);
    if (fromEdu) return fromEdu;
  }

  return null;
}

/** Display label for state (full name). */
export function kolStateDisplayName(
  kol: PublicKol,
  entry?: Pick<DolEntry, 'role' | 'education' | 'intel' | 'stateCode'>,
): string {
  const code = entry?.stateCode ?? deriveKolUsState(kol, entry);
  return code ? usStateLabel(code) : 'Unknown';
}

/** Primary institution for cards and profile. */
export function kolInstitutionLabel(
  kol: PublicKol,
  entry?: Pick<DolEntry, 'role' | 'education' | 'intel'>,
): string {
  const fromApi = kol.institution?.trim();
  if (fromApi) return fromApi;

  const affiliation = entry?.intel?.affiliation?.trim();
  if (affiliation) {
    return affiliation.split('·')[0]?.trim() || affiliation;
  }

  const role = entry?.role?.trim() ?? kol.title?.trim() ?? '';
  if (role) {
    const dashSplit = role.split(/\s+[-—]\s+/);
    const tail = dashSplit[dashSplit.length - 1]?.trim() ?? '';
    const withoutParen = tail.replace(/\s*\([^)]*\)\s*$/, '').trim();
    if (withoutParen.length > 8 && /University|Medical|Cancer|Health|Center|Institute|Hospital|Medicine|Oncology/i.test(withoutParen)) {
      return withoutParen.replace(/,\s*[A-Za-z\s]+,\s*[A-Z]{2}\.?\s*$/, '').trim();
    }
  }

  const edu = entry?.education?.trim() ?? '';
  if (edu) {
    const school = edu.split(/[;(]/)[0]?.trim() ?? '';
    if (school.length > 3) return school;
  }

  return '—';
}
