#!/usr/bin/env node
/**
 * Reads playlist IDs from a CSV and updates backend .env
 * Usage: node scripts/load-youtube-playlists.js [path/to/playlists.csv]
 *
 * CSV format: one of these:
 *   - Single column: PLxxx, PLyyy, ...
 *   - Column headers: id, playlist_id, playlistId, or first column
 *   - URLs: https://youtube.com/playlist?list=PLxxx → extracts PLxxx
 */

const fs = require('fs');
const path = require('path');

const csvPath = process.argv[2] || path.join(__dirname, '..', 'data', 'youtube-playlists.csv');
const envPath = path.join(__dirname, '..', 'backend', '.env');

function extractPlaylistId(value) {
  if (!value || typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (trimmed.startsWith('PL') && trimmed.length >= 10) return trimmed;
  const match = trimmed.match(/[?&]list=([^&\s]+)/);
  return match ? match[1] : trimmed.startsWith('PL') ? trimmed : null;
}

function parseCSV(content) {
  const lines = content.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length === 0) return [];
  const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());
  const idColName = headers.find((h) => h.includes('playlist') || h === 'id');
  const idColIndex = idColName ? headers.indexOf(idColName) : 0;
  const ids = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith('#')) continue;
    const cols = line.split(',').map((c) => c.trim());
    const val = cols[idColIndex] ?? cols[0];
    const id = extractPlaylistId(val);
    if (id) ids.push(id);
  }
  if (ids.length === 0 && lines.length > 0) {
    for (const line of lines) {
      if (line.startsWith('#')) continue;
      const first = line.split(',')[0]?.trim();
      const id = extractPlaylistId(first);
      if (id) ids.push(id);
    }
  }
  return [...new Set(ids)];
}

function main() {
  if (!fs.existsSync(csvPath)) {
    console.error(`CSV not found: ${csvPath}`);
    console.log('\nCreate data/youtube-playlists.csv with one playlist ID per line, or:');
    console.log('  id,title');
    console.log('  PLxxxxxxxxxx,My Playlist');
    console.log('\nOr run: node scripts/load-youtube-playlists.js /path/to/your.csv');
    process.exit(1);
  }

  const content = fs.readFileSync(csvPath, 'utf8');
  const ids = parseCSV(content);
  if (ids.length === 0) {
    console.error('No valid playlist IDs found in CSV.');
    process.exit(1);
  }

  const envContent = fs.readFileSync(envPath, 'utf8');
  const idsStr = ids.join(',');
  const newEnv = envContent.replace(
    /YOUTUBE_PLAYLIST_IDS=.*/,
    `YOUTUBE_PLAYLIST_IDS=${idsStr}`
  );
  fs.writeFileSync(envPath, newEnv);
  console.log(`Loaded ${ids.length} playlist IDs into backend/.env`);
  console.log('Restart the backend to see them on the catalog page.');
}

main();
