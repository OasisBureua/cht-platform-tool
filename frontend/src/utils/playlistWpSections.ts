import type { CatalogItem } from '../api/catalog';

/**
 * Option A: organize YouTube playlists into WordPress-style browse sections
 * (KOL Playlists / ASCO 2026) until ContentHub ships `wordpress.series`.
 */

export type PlaylistWpSectionId = 'kol' | 'asco-2026';

export type PlaylistWpSection = {
  id: PlaylistWpSectionId;
  label: string;
  items: CatalogItem[];
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
  // Also pick surnames after "&" / "," without Dr. prefix in compact titles
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
): PlaylistWpSection[] {
  const asco: CatalogItem[] = [];
  const kol: CatalogItem[] = [];

  for (const p of playlists) {
    if (isAsco2026Playlist(p)) asco.push(p);
    else kol.push(p);
  }

  const byTitle = (a: CatalogItem, b: CatalogItem) =>
    (a.title ?? '').localeCompare(b.title ?? '', undefined, { sensitivity: 'base' });

  kol.sort(byTitle);
  asco.sort(byTitle);

  const sections: PlaylistWpSection[] = [];
  if (kol.length > 0) {
    sections.push({ id: 'kol', label: 'KOL Playlists', items: kol });
  }
  if (asco.length > 0) {
    sections.push({ id: 'asco-2026', label: 'ASCO 2026', items: asco });
  }
  return sections;
}
