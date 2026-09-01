export type ChmProgramIdParts = {
  clientCode: string;
  sowYear: number;
  sowNumber: number;
  programFormatCode: string;
  programSequence: number;
};

export type BuildChmProgramIdInput = ChmProgramIdParts;

export type BuildChmAssetFilenameInput = {
  programId: string;
  assetFormatCode: string;
  assetSequence: number;
  renditionCode?: string | null;
  version?: number;
  extension?: string | null;
};

export type ChmValidationResult = {
  valid: boolean;
  errors: string[];
};

/** Parsed Program ID + optional asset tail from a full filename stem. */
export type ParsedChmAssetFilename = {
  programId: string;
  assetFormatCode: string;
  assetSequence: number;
  renditionCode: string | null;
  version: number;
};

/** Program ID pattern: CLIENT-YY-SS_BBBnnn (e.g. AZ-25-01_LIV001) */
export const CHM_PROGRAM_ID_REGEX =
  /^([A-Z0-9]{2,8})-(\d{2})-(\d{2})_([A-Z]{2,4})(\d{2,3})$/;

/** Program ID at the start of a longer asset stem (no end anchor). */
export const CHM_PROGRAM_ID_PREFIX_REGEX =
  /^([A-Z0-9]{2,8})-(\d{2})-(\d{2})_([A-Z]{2,4})(\d{2,3})/;

/**
 * Asset tail after Program ID: FORMATnn[_RENDITION]_vN
 * Parsing uses controlled asset format codes (not a single greedy regex).
 */
export const CHM_ASSET_STEM_REGEX =
  /^([A-Z][A-Z0-9]{1,11})(\d{2})_(?:([A-Z]{2,6})_)?v(\d+)$/;
