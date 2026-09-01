/**
 * Controlled vocabularies for CHM Content ID System v1.0.
 * Update through governance — do not add ad hoc codes in feature code.
 * Source: Program Registry & Filename Builder workbook (Content ID System).
 */

export type ChmVocabEntry = {
  code: string;
  label: string;
};

/** Section 5.1 — client / sponsor codes */
export const CHM_CLIENT_CODES: readonly ChmVocabEntry[] = [
  { code: 'AZ', label: 'AstraZeneca' },
  { code: 'DS', label: 'Daiichi Sankyo' },
  { code: 'NV', label: 'Novartis' },
  { code: 'GL', label: 'Gilead' },
  { code: 'PU', label: 'Puma Biotech' },
  { code: 'ST', label: 'Stemline' },
  { code: 'CE', label: 'Celquity' },
  { code: 'GEN', label: 'General / unassigned' },
] as const;

/** Section 5.2 — program format codes (BBB in Program ID) */
export const CHM_PROGRAM_FORMAT_CODES: readonly ChmVocabEntry[] = [
  { code: 'LIV', label: 'Livestream / Zoom webinar' },
  { code: 'PRE', label: 'Pre-recorded conversation' },
  { code: 'OH', label: 'Office hours' },
  { code: 'POD', label: 'Podcast' },
] as const;

/** Section 5.3 — asset format codes (FORMAT in asset filename) */
export const CHM_ASSET_FORMAT_CODES: readonly ChmVocabEntry[] = [
  { code: 'TRANSCRIPT', label: 'Transcript (VTT/text)' },
  { code: 'CAPTION', label: 'Closed captions' },
  { code: 'MP4', label: 'Video MP4' },
  { code: 'M4A', label: 'Audio M4A' },
  { code: 'CHAT', label: 'Chat log' },
  { code: 'PDF', label: 'PDF deliverable' },
  { code: 'DOCX', label: 'Word document' },
] as const;

/** Optional rendition segment (omit when not applicable) */
export const CHM_RENDITION_CODES: readonly ChmVocabEntry[] = [
  { code: 'HD', label: 'High definition' },
  { code: 'SD', label: 'Standard definition' },
  { code: 'RAW', label: 'Raw / unedited' },
  { code: 'FINAL', label: 'Final cut' },
] as const;

const clientCodeSet = new Set(CHM_CLIENT_CODES.map((e) => e.code));
const programFormatSet = new Set(CHM_PROGRAM_FORMAT_CODES.map((e) => e.code));
const assetFormatSet = new Set(CHM_ASSET_FORMAT_CODES.map((e) => e.code));
const renditionSet = new Set(CHM_RENDITION_CODES.map((e) => e.code));

export function isKnownClientCode(code: string): boolean {
  return clientCodeSet.has(code.toUpperCase());
}

export function isKnownProgramFormatCode(code: string): boolean {
  return programFormatSet.has(code.toUpperCase());
}

export function isKnownAssetFormatCode(code: string): boolean {
  return assetFormatSet.has(code.toUpperCase());
}

export function isKnownRenditionCode(code: string): boolean {
  return renditionSet.has(code.toUpperCase());
}

/** Maps Zoom cloud recording fileType to CHM asset format code. */
export function zoomFileTypeToChmAssetFormat(fileType: string): string {
  const t = fileType.trim().toUpperCase();
  if (t === 'TRANSCRIPT') return 'TRANSCRIPT';
  if (t === 'CC') return 'CAPTION';
  if (t === 'MP4') return 'MP4';
  if (t === 'M4A') return 'M4A';
  if (t === 'CHAT') return 'CHAT';
  if (t === 'TIMELINE' || t === 'CSV') return 'TRANSCRIPT';
  return 'MP4';
}
