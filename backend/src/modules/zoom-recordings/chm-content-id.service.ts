import { Injectable } from '@nestjs/common';
import {
  buildChmAssetFilename,
  buildChmAssetFilenameForZoomFile,
  buildChmAssetFilenameStem,
  buildChmProgramId,
  parseChmAssetFilenameStem,
  parseChmProgramId,
  validateChmAssetFilenameStem,
  validateChmProgramId,
  zoomFileTypeToChmAssetFormat,
} from './chm-content-id.util';
import {
  CHM_ASSET_FORMAT_CODES,
  CHM_CLIENT_CODES,
  CHM_PROGRAM_FORMAT_CODES,
  CHM_RENDITION_CODES,
} from './chm-content-id.vocab';

export type {
  BuildChmAssetFilenameInput,
  BuildChmProgramIdInput,
  ChmProgramIdParts,
  ChmValidationResult,
  ParsedChmAssetFilename,
} from './chm-content-id.types';

@Injectable()
export class ChmContentIdService {
  readonly clientCodes = CHM_CLIENT_CODES;
  readonly programFormatCodes = CHM_PROGRAM_FORMAT_CODES;
  readonly assetFormatCodes = CHM_ASSET_FORMAT_CODES;
  readonly renditionCodes = CHM_RENDITION_CODES;

  buildProgramId = buildChmProgramId;
  parseProgramId = parseChmProgramId;
  validateProgramId = validateChmProgramId;

  buildAssetFilename = buildChmAssetFilename;
  buildAssetFilenameStem = buildChmAssetFilenameStem;
  parseAssetFilenameStem = parseChmAssetFilenameStem;
  validateAssetFilenameStem = validateChmAssetFilenameStem;

  zoomFileTypeToAssetFormat = zoomFileTypeToChmAssetFormat;
  buildAssetFilenameForZoomFile = buildChmAssetFilenameForZoomFile;
}
