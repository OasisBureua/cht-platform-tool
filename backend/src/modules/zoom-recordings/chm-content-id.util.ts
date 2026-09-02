import {
  CHM_PROGRAM_ID_PREFIX_REGEX,
  CHM_PROGRAM_ID_REGEX,
  type BuildChmAssetFilenameInput,
  type BuildChmProgramIdInput,
  type ChmProgramIdParts,
  type ChmValidationResult,
  type ParsedChmAssetFilename,
} from './chm-content-id.types';
import {
  CHM_ASSET_FORMAT_CODES,
  isKnownAssetFormatCode,
  isKnownClientCode,
  isKnownProgramFormatCode,
  isKnownRenditionCode,
  zoomFileTypeToChmAssetFormat,
} from './chm-content-id.vocab';

export { zoomFileTypeToChmAssetFormat };

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function pad3(n: number): string {
  return String(n).padStart(3, '0');
}

function invalid(errors: string[]): ChmValidationResult {
  return { valid: false, errors };
}

function valid(): ChmValidationResult {
  return { valid: true, errors: [] };
}

export function buildChmProgramId(input: BuildChmProgramIdInput): string {
  const clientCode = input.clientCode.trim().toUpperCase();
  const programFormatCode = input.programFormatCode.trim().toUpperCase();
  const yy = pad2(input.sowYear % 100);
  const ss = pad2(input.sowNumber);
  const seq = pad3(input.programSequence);
  return `${clientCode}-${yy}-${ss}_${programFormatCode}${seq}`;
}

export function parseChmProgramId(programId: string): ChmProgramIdParts | null {
  const trimmed = programId.trim().toUpperCase();
  const match = CHM_PROGRAM_ID_REGEX.exec(trimmed);
  if (!match) return null;
  return {
    clientCode: match[1],
    sowYear: Number.parseInt(match[2], 10),
    sowNumber: Number.parseInt(match[3], 10),
    programFormatCode: match[4],
    programSequence: Number.parseInt(match[5], 10),
  };
}

export function validateChmProgramId(programId: string): ChmValidationResult {
  const errors: string[] = [];
  const trimmed = programId?.trim();
  if (!trimmed) {
    return invalid(['Program ID is required']);
  }

  const parts = parseChmProgramId(trimmed);
  if (!parts) {
    return invalid([
      'Program ID must match CLIENT-YY-SS_BBBnnn (e.g. AZ-25-01_LIV001)',
    ]);
  }

  if (!isKnownClientCode(parts.clientCode)) {
    errors.push(`Unknown client code "${parts.clientCode}"`);
  }
  if (!isKnownProgramFormatCode(parts.programFormatCode)) {
    errors.push(`Unknown program format code "${parts.programFormatCode}"`);
  }
  if (parts.sowNumber < 1 || parts.sowNumber > 99) {
    errors.push('SOW number must be between 01 and 99');
  }
  if (parts.programSequence < 1 || parts.programSequence > 999) {
    errors.push('Program sequence must be between 001 and 999');
  }

  return errors.length ? invalid(errors) : valid();
}

export function buildChmAssetFilenameStem(
  input: BuildChmAssetFilenameInput,
): string {
  const programValidation = validateChmProgramId(input.programId);
  if (!programValidation.valid) {
    throw new Error(programValidation.errors.join('; '));
  }

  const assetFormatCode = input.assetFormatCode.trim().toUpperCase();
  const assetSeq = pad2(input.assetSequence);
  const version = input.version && input.version > 0 ? input.version : 1;
  const rendition = input.renditionCode?.trim().toUpperCase();

  let stem = `${input.programId.trim().toUpperCase()}_${assetFormatCode}${assetSeq}`;
  if (rendition) {
    stem += `_${rendition}`;
  }
  stem += `_v${version}`;
  return stem;
}

export function buildChmAssetFilename(input: BuildChmAssetFilenameInput): string {
  const stem = buildChmAssetFilenameStem(input);
  const ext = input.extension?.trim().replace(/^\./, '').toLowerCase();
  return ext ? `${stem}.${ext}` : stem;
}

export function parseChmAssetFilenameStem(
  stem: string,
): ParsedChmAssetFilename | null {
  const trimmed = stem.trim().toUpperCase();
  const programMatch = CHM_PROGRAM_ID_PREFIX_REGEX.exec(trimmed);
  if (!programMatch) return null;

  const programId = programMatch[0];
  const rest = trimmed.slice(programId.length);
  if (!rest.startsWith('_')) return null;

  const assetTail = rest.slice(1);
  const versionMatch = /_v(\d+)$/i.exec(assetTail);
  if (!versionMatch) return null;

  const version = Number.parseInt(versionMatch[1], 10);
  let body = assetTail.slice(0, -versionMatch[0].length);

  let renditionCode: string | null = null;
  const renditionMatch = /_([A-Z]{2,6})$/.exec(body);
  if (renditionMatch && isKnownRenditionCode(renditionMatch[1])) {
    renditionCode = renditionMatch[1];
    body = body.slice(0, -renditionMatch[0].length);
  }

  const formatCodes = [...CHM_ASSET_FORMAT_CODES]
    .map((e) => e.code)
    .sort((a, b) => b.length - a.length);

  for (const code of formatCodes) {
    if (!body.startsWith(code) || body.length < code.length + 2) continue;
    const seqStr = body.slice(code.length, code.length + 2);
    if (!/^\d{2}$/.test(seqStr) || body.length !== code.length + 2) continue;
    return {
      programId,
      assetFormatCode: code,
      assetSequence: Number.parseInt(seqStr, 10),
      renditionCode,
      version,
    };
  }

  return null;
}

export function validateChmAssetFilenameStem(stem: string): ChmValidationResult {
  const errors: string[] = [];
  const parsed = parseChmAssetFilenameStem(stem);
  if (!parsed) {
    return invalid([
      'Asset filename must match CLIENT-YY-SS_BBBnnn_FORMATnn[_RENDITION]_vN',
    ]);
  }

  const programValidation = validateChmProgramId(parsed.programId);
  errors.push(...programValidation.errors);

  if (!isKnownAssetFormatCode(parsed.assetFormatCode)) {
    errors.push(`Unknown asset format code "${parsed.assetFormatCode}"`);
  }
  if (parsed.assetSequence < 1 || parsed.assetSequence > 99) {
    errors.push('Asset sequence must be between 01 and 99');
  }
  if (parsed.renditionCode && !isKnownRenditionCode(parsed.renditionCode)) {
    errors.push(`Unknown rendition code "${parsed.renditionCode}"`);
  }
  if (parsed.version < 1) {
    errors.push('Version must be at least 1');
  }

  return errors.length ? invalid(errors) : valid();
}

export function buildChmAssetFilenameForZoomFile(opts: {
  chmProgramId: string;
  zoomFileType: string;
  fileExtension?: string | null;
  assetSequence?: number;
  renditionCode?: string | null;
  version?: number;
}): string {
  const assetFormatCode = zoomFileTypeToChmAssetFormat(opts.zoomFileType);
  const ext =
    opts.fileExtension?.trim().replace(/^\./, '').toLowerCase() ||
    defaultExtensionForAssetFormat(assetFormatCode);

  return buildChmAssetFilename({
    programId: opts.chmProgramId,
    assetFormatCode,
    assetSequence: opts.assetSequence ?? 1,
    renditionCode: opts.renditionCode,
    version: opts.version ?? 1,
    extension: ext,
  });
}

function defaultExtensionForAssetFormat(assetFormatCode: string): string {
  switch (assetFormatCode) {
    case 'TRANSCRIPT':
    case 'CAPTION':
      return 'vtt';
    case 'MP4':
      return 'mp4';
    case 'M4A':
      return 'm4a';
    case 'CHAT':
      return 'txt';
    case 'PDF':
      return 'pdf';
    case 'DOCX':
      return 'docx';
    default:
      return 'bin';
  }
}
