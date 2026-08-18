#!/usr/bin/env node
/**
 * SCRUM-148: Generate static KOL → Playlists map for the Engagement tab.
 *
 * Fetches live catalog data (playlists + doctors) from a running backend,
 * parses doctor surnames out of playlist titles, and emits a static TS map
 * to frontend/src/data/kol-playlists.generated.ts.
 *
 * Static (not live-joined) because the WordPress + curator playlist system is
 * on the deprecation path — Framer migration will replace it with proper
 * collection references. Rerun this script when Marni publishes new
 * playlists.
 *
 * Usage:
 *   node frontend/scripts/generate-kol-playlists.mjs
 *   API_BASE=https://devapp.communityhealth.media/api node frontend/scripts/generate-kol-playlists.mjs
 */

import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const API_BASE = process.env.API_BASE || 'https://devapp.communityhealth.media/api';
const OUT_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../src/data/kol-playlists.generated.ts',
);

async function fetchJson(path) {
  const res = await fetch(`${API_BASE}${path}`);
  if (!res.ok) throw new Error(`GET ${path} → ${res.status}`);
  return res.json();
}

/**
 * Extract doctor last-name tokens from a playlist title.
 * Titles look like:
 *   "... with Drs. Bill Gradishar & Tiffany Traina"
 *   "... with Dr. Mark Pegram & Dr. Carol Tweed"
 *   "... - Dr. Gregory Vidal & Dr. Nusayba Bagegni"
 *   "... with Drs. Neil Iyengar, Komal Jhaveri, & Igor Makhlin"
 * Returns lowercase last-name tokens: ["gradishar", "traina"].
 */
function parseDoctorsFromTitle(title) {
  // Everything after the first "Dr." / "Drs." occurrence
  const drIdx = title.search(/Drs?\.?\s/i);
  if (drIdx < 0) return [];
  const doctorSection = title.slice(drIdx);

  // Split on & or , — each chunk should contain one doctor name
  const chunks = doctorSection.split(/\s*(?:&|,|and)\s*/i);
  const surnames = new Set();

  for (const chunk of chunks) {
    // Strip leading "Drs.", "Dr.", punctuation, spaces
    const cleaned = chunk
      .replace(/^Drs?\.?\s*/i, '')
      .replace(/[.,;:]/g, '')
      .trim();
    if (!cleaned) continue;

    // Last whitespace-separated token = surname
    // Handle O'Shaughnessy, Garrido-Castro, etc.
    const parts = cleaned.split(/\s+/).filter(Boolean);
    if (parts.length === 0) continue;
    const last = parts[parts.length - 1];
    // Normalize: strip apostrophes and lowercase (matches doctor slug form)
    const normalized = last.toLowerCase().replace(/['’]/g, '');
    if (normalized.length >= 3 && /^[a-z\-]+$/.test(normalized)) {
      surnames.add(normalized);
    }
  }

  return Array.from(surnames);
}

/**
 * Resolve a parsed surname to a canonical doctor slug from the /doctors list.
 * Handles hyphenated names (garrido-castro), and slug-vs-surname variance.
 */
function resolveDoctorSlug(surname, doctorSlugs) {
  const s = surname.toLowerCase();
  // Exact match wins
  if (doctorSlugs.has(s)) return s;
  // Hyphenated surname → try full hyphenated form vs just tail
  if (s.includes('-')) {
    if (doctorSlugs.has(s)) return s;
  }
  // Check if any slug ends with this surname (e.g. slug "garrido-castro" from title "Garrido-Castro")
  for (const slug of doctorSlugs) {
    if (slug === s || slug.endsWith(`-${s}`) || slug === s.replace(/-/g, '')) {
      return slug;
    }
  }
  return null;
}

async function main() {
  console.log(`[generate-kol-playlists] Fetching from ${API_BASE}`);

  const [playlists, doctors] = await Promise.all([
    fetchJson('/catalog/playlists'),
    fetchJson('/catalog/doctors'),
  ]);

  const doctorSlugSet = new Set(doctors.map((d) => d.slug));
  console.log(`[generate-kol-playlists] Loaded ${playlists.length} playlists, ${doctors.length} doctors`);

  // doctorSlug → [{ playlistId, title, thumbnailUrl, videoCount }]
  const map = {};
  const unresolved = new Set();

  for (const pl of playlists) {
    const surnames = parseDoctorsFromTitle(pl.title);
    if (surnames.length === 0) {
      console.warn(`  [warn] No doctors parsed from: "${pl.title}"`);
      continue;
    }

    for (const surname of surnames) {
      const slug = resolveDoctorSlug(surname, doctorSlugSet);
      if (!slug) {
        unresolved.add(surname);
        continue;
      }
      if (!map[slug]) map[slug] = [];
      map[slug].push({
        id: pl.id,
        title: pl.title,
        thumbnailUrl: pl.thumbnailUrl,
        videoCount: pl.videoCount,
      });
    }
  }

  // Deterministic ordering — sort keys + entries by title
  const sortedMap = {};
  for (const key of Object.keys(map).sort()) {
    sortedMap[key] = map[key].sort((a, b) => a.title.localeCompare(b.title));
  }

  // Reverse map: playlistId → [doctor slugs featured]
  const reverse = {};
  for (const [slug, refs] of Object.entries(sortedMap)) {
    for (const ref of refs) {
      if (!reverse[ref.id]) reverse[ref.id] = [];
      if (!reverse[ref.id].includes(slug)) reverse[ref.id].push(slug);
    }
  }
  const sortedReverse = {};
  for (const key of Object.keys(reverse).sort()) {
    sortedReverse[key] = reverse[key].sort();
  }

  const generatedAt = new Date().toISOString();
  const totalPlaylists = playlists.length;
  const kolsWithPlaylists = Object.keys(sortedMap).length;
  const totalMappings = Object.values(sortedMap).reduce((n, arr) => n + arr.length, 0);

  const banner = `/**
 * AUTO-GENERATED — do not edit by hand.
 *
 * SCRUM-148: Static map of KOL doctor slugs → playlists they appear in.
 * Generated by frontend/scripts/generate-kol-playlists.mjs at ${generatedAt}.
 * Source: ${API_BASE}
 *
 * Regenerate when Marni publishes new playlists:
 *   node frontend/scripts/generate-kol-playlists.mjs
 *
 * ${totalPlaylists} playlists total, ${kolsWithPlaylists} KOLs mapped, ${totalMappings} playlist ↔ KOL edges.
 *
 * Static because WordPress + curator playlist plumbing is on the deprecation
 * path — Framer migration will replace this with proper collection references.
 */

export interface KolPlaylistRef {
  /** YouTube playlist ID (starts with PL...). */
  id: string;
  /** Full playlist title as shown on YouTube. */
  title: string;
  /** Thumbnail from YouTube's playlist snippet. */
  thumbnailUrl: string;
  /** Number of videos in the playlist. */
  videoCount: number;
}

/**
 * Keyed by MediaHub doctor slug (e.g. "bardia", "garrido-castro").
 * Same slug shape returned by GET /api/catalog/doctors.
 */
export const KOL_PLAYLISTS: Record<string, KolPlaylistRef[]> = ${JSON.stringify(sortedMap, null, 2)};

/**
 * Reverse index: playlist id → list of doctor slugs featured in it.
 * Used by /catalog/playlist/:id to render "Featured physicians" strip.
 */
export const PLAYLIST_KOLS: Record<string, string[]> = ${JSON.stringify(sortedReverse, null, 2)};
`;

  writeFileSync(OUT_PATH, banner, 'utf8');

  console.log(`[generate-kol-playlists] Wrote ${OUT_PATH}`);
  console.log(`  ${totalPlaylists} playlists`);
  console.log(`  ${kolsWithPlaylists} KOLs with at least one playlist`);
  console.log(`  ${totalMappings} total KOL↔playlist edges`);
  if (unresolved.size > 0) {
    console.warn(`  [warn] ${unresolved.size} unresolved surnames (not in /doctors):`, [...unresolved]);
  }
}

main().catch((err) => {
  console.error('[generate-kol-playlists] Failed:', err);
  process.exit(1);
});
