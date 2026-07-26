import type { CatalogItem, PlaylistTagOverlay } from '../api/catalog';

/**
 * Organize YouTube playlists into browse sections by topic.
 *
 * SCRUM-81 (2026-07-21): now prefers the curator-set tag overlay
 * (`PlaylistTagOverlay`) from ContentHub `/api/public/playlists`. The
 * title-heuristic regexes below (`classifyPlaylistSection`) are kept
 * ONLY as a fallback for playlists a curator hasn't tagged yet. Once
 * every live playlist has a tag overlay row, the regex path becomes
 * dead code and can be deleted.
 */

export type PlaylistWpSectionId =
  | 'her2'
  | 'her2-low'
  | 'hr'
  | 'tnbc-adc'
  | 'asco-2026'
  | 'more';

/**
 * Curator tag→section mapping. Each entry is a match predicate against
 * the overlay's `tags` array + optional `lane`. First-match wins. If no
 * predicate matches, fall through to the title-regex classifier.
 *
 * The predicate looks at freeform tag values (e.g. `biomarker:HER2+`,
 * `biomarker:HER2-low`, `conference:ASCO 2026`). Namespace-agnostic
 * substring check since curator values are freeform per SCRUM-73.
 */
const TAG_TO_SECTION: readonly {
  id: PlaylistWpSectionId;
  match: (overlay: PlaylistTagOverlay) => boolean;
}[] = [
  {
    id: 'asco-2026',
    match: (o) =>
      (o.lane ?? '').toLowerCase() === 'archive'
        ? false
        : o.tags.some((t) => /conference:\s*asco\s*2026/i.test(t)),
  },
  {
    id: 'her2-low',
    match: (o) => o.tags.some((t) => /biomarker:\s*her2[-\s]?(low|ultralow|ultra-low)/i.test(t)),
  },
  {
    id: 'her2',
    match: (o) =>
      o.tags.some((t) => /biomarker:\s*her2\+/i.test(t)) ||
      o.tags.some((t) => /biomarker:\s*her2\s*positive/i.test(t)),
  },
  {
    id: 'tnbc-adc',
    match: (o) =>
      o.tags.some((t) =>
        /biomarker:\s*(triple[-\s]?negative|tnbc)/i.test(t),
      ),
  },
  {
    id: 'hr',
    match: (o) =>
      o.tags.some((t) => /biomarker:\s*hr\+/i.test(t)) ||
      o.tags.some((t) => /biomarker:\s*hr\s*positive/i.test(t)),
  },
];

function classifyFromOverlay(
  overlay: PlaylistTagOverlay,
): PlaylistWpSectionId | null {
  for (const rule of TAG_TO_SECTION) {
    if (rule.match(overlay)) return rule.id;
  }
  return null;
}

export type PlaylistWpSection = {
  id: PlaylistWpSectionId;
  label: string;
  items: CatalogItem[];
};

const SECTION_ORDER: readonly PlaylistWpSectionId[] = [
  'her2',
  'her2-low',
  'hr',
  'tnbc-adc',
  'asco-2026',
  'more',
];

const SECTION_LABELS: Record<PlaylistWpSectionId, string> = {
  her2: 'HER2+ Conversations',
  'her2-low': 'HER2-Low / Ultra-Low',
  hr: 'HR+ · CDK4/6 · Endocrine',
  'tnbc-adc': 'TNBC & ADCs',
  'asco-2026': 'ASCO 2026',
  more: 'More playlists',
};

/** Doctor-name sets that identify ASCO 2026 series on communityhealth.media. */
const ASCO_2026_DOCTOR_SETS: readonly (readonly string[])[] = [
  ['siva', 'anders'],
  ['taylor', 'davis'],
  ['vidal', 'advani', 'king'],
  ['rugo', 'hurvitz', 'tseng'],
  ['mouabbi', 'conlin', 'basho'],
  ['mouabbi', 'yan', 'tarantino'],
  ['oshaughnessy', 'lucci', 'rimawi'],
  ['jhaveri', 'tolaney', 'modi'],
  ['mardones', 'oshaughnessy'],
  ['mazo', 'puri', 'moscol'],
  ['pegram', 'wander'],
  ['kruse', 'rader', 'vikas'],
  ['kruse', 'gradishar', 'khan'],
  ['bagegni', 'lammers'],
  ['reddy', 'elkhanany'],
  ['premji', 'mahtani', 'mamounas'],
  ['brown-glaberman', 'giridhar'],
  ['iyengar', 'oshaughnessy', 'garrido'],
];

const ASCO_TITLE_HINTS = [
  /\basco\b/i,
  /\bemerald-?3\b/i,
  /\bmatterhorn\b/i,
  /destiny-breast05.*destiny-breast11.*t-dxd integration/i,
  /t-dxd:\s*new curative approvals/i,
  /frontline tnbc and adc advances/i,
  /db11\s*&\s*db05 change her2/i,
  /early stage her2\+.*db11/i,
  /akt-pathway.*sequencing in er\+/i,
  /endocrine resistance.*esr1.*seth wander/i,
  /first-line adcs in metastatic/i,
  /integrating t-dxd across her2/i,
  /targeting.*sequencing endocrine pathways after cdk4/i,
  /evolving adcs in 1l mtnbc/i,
  /expanding t-dxd across her2/i,
  /managing capivasertib.*akt pathway/i,
];

function normalizeDoctorToken(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z]/g, '');
}

function titleDoctorTokens(title: string): Set<string> {
  const tokens = new Set<string>();
  const re = /\b(?:Dr\.?|Drs\.?)\s+([A-Za-z][A-Za-z'.-]*)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(title)) !== null) {
    const t = normalizeDoctorToken(m[1]);
    if (t.length >= 3) tokens.add(t);
  }
  const afterWith = title.match(/\bwith\s+(.+)$/i)?.[1] ?? '';
  for (const part of afterWith.split(/[,&]| and /i)) {
    const words = part.trim().split(/\s+/);
    const last = words[words.length - 1];
    if (last) {
      const t = normalizeDoctorToken(last);
      if (t.length >= 3) tokens.add(t);
    }
  }
  return tokens;
}

export function isAsco2026Playlist(playlist: CatalogItem): boolean {
  const title = playlist.title ?? '';
  if (ASCO_TITLE_HINTS.some((re) => re.test(title))) return true;

  const tokens = titleDoctorTokens(title);
  if (tokens.size === 0) return false;

  return ASCO_2026_DOCTOR_SETS.some((set) =>
    set.every((name) => {
      const needle = normalizeDoctorToken(name);
      return [...tokens].some((t) => t === needle || t.includes(needle) || needle.includes(t));
    }),
  );
}

/** Classify a playlist into a browse section from its title. */
export function classifyPlaylistSection(playlist: CatalogItem): PlaylistWpSectionId {
  if (isAsco2026Playlist(playlist)) return 'asco-2026';

  const t = playlist.title ?? '';

  if (/HER2-?[Ll]ow|ultra-?low|DB-?04|DB-?06|Destiny-Breast0[46]/i.test(t)) {
    return 'her2-low';
  }
  if (
    /TNBC|triple.?negative|mTNBC|Datopotamab|Dato-?DXd|Sacituzumab|Govitecan|Trop-?2/i.test(t) &&
    !/HER2\+|HER2 positive|DESTINY-Breast09|DB09|DB-?09/i.test(t)
  ) {
    return 'tnbc-adc';
  }
  if (
    /HR\+|CDK4|endocrine|ESR1|SERD|capivasertib|AKT|ER\+|estrogen/i.test(t) &&
    !/HER2|DESTINY-Breast|T-DXd/i.test(t)
  ) {
    return 'hr';
  }
  if (
    /HER2|DESTINY-Breast|T-DXd|Enhertu|Pertuzumab|Cleopatra|DB09|DB-?09|DB11|DB-?11|first-?line/i.test(
      t,
    )
  ) {
    return 'her2';
  }
  return 'more';
}

/**
 * Pull a WP-style speaker line from playlist titles like
 * "… with Drs. Bill Gradishar & Tiffany Traina".
 */
export function extractPlaylistSpeakers(title: string): string | null {
  const withMatch = title.match(/\bwith\s+(Drs?\.?\s+.+)$/i);
  if (withMatch?.[1]) {
    return withMatch[1]
      .replace(/\s+/g, ' ')
      .replace(/\s+&\s+/g, ' & ')
      .trim();
  }
  const dashMatch = title.match(/[-–—]\s*((?:Drs?\.?\s+).+)$/i);
  if (dashMatch?.[1]) return dashMatch[1].replace(/\s+/g, ' ').trim();
  return null;
}

export function playlistCardDescription(item: CatalogItem): string {
  const speakers = extractPlaylistSpeakers(item.title ?? '');
  const count =
    item.videoCount > 0
      ? `${item.videoCount} video${item.videoCount !== 1 ? 's' : ''}`
      : item.videoNames?.length
        ? `${item.videoNames.length} video${item.videoNames.length !== 1 ? 's' : ''}`
        : '';
  if (speakers && count) return `${speakers}\n${count}`;
  return speakers || count || '';
}

/** Display title without trailing "with Drs. …" when we show speakers separately. */
export function playlistDisplayTitle(title: string): string {
  const cleaned = title
    .replace(/\s+with\s+Drs?\.?\s+.+$/i, '')
    .replace(/\s+[-–—]\s*Drs?\.?\s+.+$/i, '')
    .trim();
  return cleaned.length >= 12 ? cleaned : title;
}

export function groupPlaylistsIntoWpSections(
  playlists: CatalogItem[],
  tagOverlay?: PlaylistTagOverlay[],
): PlaylistWpSection[] {
  const buckets = new Map<PlaylistWpSectionId, CatalogItem[]>();
  for (const id of SECTION_ORDER) buckets.set(id, []);

  // SCRUM-81: curator tag overlay wins over title regex. Index overlay
  // by youtube_playlist_id so we can lookup per-playlist O(1).
  const overlayById = new Map<string, PlaylistTagOverlay>();
  for (const o of tagOverlay ?? []) {
    if (o.youtube_playlist_id) overlayById.set(o.youtube_playlist_id, o);
  }

  for (const p of playlists) {
    const overlay = overlayById.get(p.id);
    const fromOverlay = overlay ? classifyFromOverlay(overlay) : null;
    const section = fromOverlay ?? classifyPlaylistSection(p);
    buckets.get(section)!.push(p);
  }

  const byTitle = (a: CatalogItem, b: CatalogItem) =>
    (a.title ?? '').localeCompare(b.title ?? '', undefined, { sensitivity: 'base' });

  const sections: PlaylistWpSection[] = [];
  for (const id of SECTION_ORDER) {
    const items = buckets.get(id) ?? [];
    if (items.length === 0) continue;
    items.sort(byTitle);
    sections.push({ id, label: SECTION_LABELS[id], items });
  }
  return sections;
}
