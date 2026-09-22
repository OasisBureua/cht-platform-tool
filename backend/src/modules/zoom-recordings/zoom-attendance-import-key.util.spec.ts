import {
  canImportReportParticipant,
  normalizeReportParticipantEmail,
  normalizeReportZoomParticipantId,
} from './zoom-attendance-import-key.util';

describe('normalizeReportZoomParticipantId', () => {
  it('returns null for missing or blank ids', () => {
    expect(normalizeReportZoomParticipantId(undefined)).toBeNull();
    expect(normalizeReportZoomParticipantId(null)).toBeNull();
    expect(normalizeReportZoomParticipantId('')).toBeNull();
    expect(normalizeReportZoomParticipantId('   ')).toBeNull();
  });

  it('returns trimmed id when present', () => {
    expect(normalizeReportZoomParticipantId('  zp-1  ')).toBe('zp-1');
  });
});

describe('canImportReportParticipant', () => {
  it('requires join time and at least one identity field', () => {
    expect(
      canImportReportParticipant({
        id: null,
        joinTime: '2026-08-01T18:00:00Z',
        userEmail: 'guest@test.com',
        name: 'Guest',
      }),
    ).toBe(true);
    expect(
      canImportReportParticipant({
        id: 'zp-1',
        joinTime: '2026-08-01T18:00:00Z',
      }),
    ).toBe(true);
    expect(
      canImportReportParticipant({
        id: null,
        joinTime: '2026-08-01T18:00:00Z',
        name: 'Anonymous',
      }),
    ).toBe(true);
    expect(
      canImportReportParticipant({
        id: null,
        joinTime: undefined,
        userEmail: 'guest@test.com',
      }),
    ).toBe(false);
    expect(
      canImportReportParticipant({
        id: null,
        joinTime: '2026-08-01T18:00:00Z',
      }),
    ).toBe(false);
  });
});

describe('normalizeReportParticipantEmail', () => {
  it('lowercases and trims email', () => {
    expect(normalizeReportParticipantEmail('  A@Test.COM ')).toBe('a@test.com');
  });
});
