import {
  attendanceParticipantSearchWhere,
  buildWebinarParticipantEventListWhere,
  buildZoomAttendanceParticipantListWhere,
  clampAttendanceListPage,
  normalizeAttendanceSearchTerm,
} from './zoom-attendance-search.util';

describe('normalizeAttendanceSearchTerm', () => {
  it('returns undefined for empty or whitespace input', () => {
    expect(normalizeAttendanceSearchTerm(undefined)).toBeUndefined();
    expect(normalizeAttendanceSearchTerm(null)).toBeUndefined();
    expect(normalizeAttendanceSearchTerm('')).toBeUndefined();
    expect(normalizeAttendanceSearchTerm('   ')).toBeUndefined();
  });

  it('trims and preserves non-empty terms', () => {
    expect(normalizeAttendanceSearchTerm('  alice@test.com  ')).toBe(
      'alice@test.com',
    );
  });

  it('caps very long search strings', () => {
    const long = 'a'.repeat(250);
    expect(normalizeAttendanceSearchTerm(long)).toHaveLength(200);
  });
});

describe('attendanceParticipantSearchWhere', () => {
  it('matches name, email, and Zoom participant ID', () => {
    expect(attendanceParticipantSearchWhere('smith')).toEqual({
      OR: [
        { participantName: { contains: 'smith', mode: 'insensitive' } },
        { participantEmail: { contains: 'smith', mode: 'insensitive' } },
        { zoomParticipantId: { contains: 'smith', mode: 'insensitive' } },
      ],
    });
  });
});

describe('buildWebinarParticipantEventListWhere', () => {
  it('combines base filters with search using AND', () => {
    expect(
      buildWebinarParticipantEventListWhere(
        { programId: 'prog-1', event: 'JOINED', zoomMeetingId: '123' },
        'ali',
      ),
    ).toEqual({
      AND: [
        { programId: 'prog-1', event: 'JOINED', zoomMeetingId: '123' },
        {
          OR: [
            { participantName: { contains: 'ali', mode: 'insensitive' } },
            { participantEmail: { contains: 'ali', mode: 'insensitive' } },
            { zoomParticipantId: { contains: 'ali', mode: 'insensitive' } },
          ],
        },
      ],
    });
  });

  it('returns base filter when search is blank', () => {
    const base = { sessionId: 'sess-1' };
    expect(buildZoomAttendanceParticipantListWhere(base, '   ')).toEqual(base);
  });
});

describe('clampAttendanceListPage', () => {
  it('keeps in-range pages unchanged', () => {
    expect(clampAttendanceListPage(2, 25, 10)).toBe(2);
  });

  it('clamps to last page when results shrink', () => {
    expect(clampAttendanceListPage(5, 12, 10)).toBe(2);
  });

  it('returns page 1 when there are no matches', () => {
    expect(clampAttendanceListPage(3, 0, 10)).toBe(1);
  });
});
