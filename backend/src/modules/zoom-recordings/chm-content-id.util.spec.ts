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

describe('buildChmProgramId', () => {
  it('assembles CLIENT-YY-SS_BBBnnn', () => {
    expect(
      buildChmProgramId({
        clientCode: 'az',
        sowYear: 2025,
        sowNumber: 1,
        programFormatCode: 'liv',
        programSequence: 1,
      }),
    ).toBe('AZ-25-01_LIV001');
  });
});

describe('validateChmProgramId', () => {
  it('accepts a known client and program format', () => {
    expect(validateChmProgramId('AZ-25-01_LIV001')).toEqual({
      valid: true,
      errors: [],
    });
  });

  it('rejects unknown client code', () => {
    const result = validateChmProgramId('ZZ-25-01_LIV001');
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('Unknown client code'))).toBe(
      true,
    );
  });

  it('rejects malformed id', () => {
    expect(validateChmProgramId('not-valid').valid).toBe(false);
  });
});

describe('parseChmProgramId', () => {
  it('round-trips built ids', () => {
    const id = buildChmProgramId({
      clientCode: 'DS',
      sowYear: 26,
      sowNumber: 3,
      programFormatCode: 'PRE',
      programSequence: 12,
    });
    expect(parseChmProgramId(id)).toEqual({
      clientCode: 'DS',
      sowYear: 26,
      sowNumber: 3,
      programFormatCode: 'PRE',
      programSequence: 12,
    });
  });
});

describe('buildChmAssetFilename', () => {
  it('builds transcript filename without rendition', () => {
    expect(
      buildChmAssetFilename({
        programId: 'AZ-25-01_LIV001',
        assetFormatCode: 'TRANSCRIPT',
        assetSequence: 1,
        version: 1,
        extension: 'vtt',
      }),
    ).toBe('AZ-25-01_LIV001_TRANSCRIPT01_v1.vtt');
  });

  it('includes optional rendition for video', () => {
    expect(
      buildChmAssetFilenameStem({
        programId: 'AZ-25-01_LIV001',
        assetFormatCode: 'MP4',
        assetSequence: 1,
        renditionCode: 'HD',
        version: 2,
      }),
    ).toBe('AZ-25-01_LIV001_MP401_HD_v2');
  });
});

describe('validateChmAssetFilenameStem', () => {
  it('validates a complete stem', () => {
    expect(
      validateChmAssetFilenameStem('AZ-25-01_LIV001_TRANSCRIPT01_v1'),
    ).toEqual({ valid: true, errors: [] });
  });

  it('rejects unknown asset format', () => {
    const result = validateChmAssetFilenameStem('AZ-25-01_LIV001_FOO01_v1');
    expect(result.valid).toBe(false);
  });
});

describe('parseChmAssetFilenameStem', () => {
  it('parses stem with rendition', () => {
    expect(parseChmAssetFilenameStem('AZ-25-01_LIV001_MP401_HD_v2')).toEqual({
      programId: 'AZ-25-01_LIV001',
      assetFormatCode: 'MP4',
      assetSequence: 1,
      renditionCode: 'HD',
      version: 2,
    });
  });
});

describe('zoomFileTypeToChmAssetFormat', () => {
  it('maps Zoom types to CHM asset codes', () => {
    expect(zoomFileTypeToChmAssetFormat('TRANSCRIPT')).toBe('TRANSCRIPT');
    expect(zoomFileTypeToChmAssetFormat('CC')).toBe('CAPTION');
    expect(zoomFileTypeToChmAssetFormat('MP4')).toBe('MP4');
  });
});

describe('buildChmAssetFilenameForZoomFile', () => {
  it('builds filename from Zoom file metadata', () => {
    expect(
      buildChmAssetFilenameForZoomFile({
        chmProgramId: 'AZ-25-01_LIV001',
        zoomFileType: 'TRANSCRIPT',
        fileExtension: 'vtt',
      }),
    ).toBe('AZ-25-01_LIV001_TRANSCRIPT01_v1.vtt');
  });
});
