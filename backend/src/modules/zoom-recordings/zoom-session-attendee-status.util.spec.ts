import {
  buildSessionAttendeeStatusFields,
  loadSessionAttendeeImportCounts,
} from './zoom-session-attendee-status.util';

describe('zoom-session-attendee-status.util', () => {
  describe('buildSessionAttendeeStatusFields', () => {
    const base = {
      id: 'sess-1',
      programId: 'prog-1',
      zoomMeetingId: '123',
      attendanceLastImportedAt: null,
      attendeeReportS3Bucket: null,
      attendeeReportS3Key: null,
      attendeeReportExportedAt: null,
      attendeeReportParticipantCount: null,
    };

    it('marks not imported when no signals exist', () => {
      expect(buildSessionAttendeeStatusFields(base, 0)).toEqual({
        attendeesImported: false,
        attendeeImportCount: 0,
        attendeeReportStoredInS3: false,
        attendeeReportExportedAt: null,
        attendeeReportParticipantCount: null,
        attendanceLastImportedAt: null,
      });
    });

    it('marks imported when attendanceLastImportedAt is set', () => {
      const importedAt = new Date('2026-09-01T12:00:00.000Z');
      const result = buildSessionAttendeeStatusFields(
        { ...base, attendanceLastImportedAt: importedAt },
        0,
      );
      expect(result.attendeesImported).toBe(true);
      expect(result.attendanceLastImportedAt).toBe(importedAt.toISOString());
    });

    it('marks imported when import count is positive', () => {
      expect(buildSessionAttendeeStatusFields(base, 3).attendeesImported).toBe(true);
    });

    it('marks imported when report was exported to S3', () => {
      const exportedAt = new Date('2026-09-01T12:00:00.000Z');
      const result = buildSessionAttendeeStatusFields(
        {
          ...base,
          attendeeReportS3Bucket: 'bucket',
          attendeeReportS3Key: 'key.csv',
          attendeeReportExportedAt: exportedAt,
          attendeeReportParticipantCount: 5,
        },
        0,
      );
      expect(result.attendeesImported).toBe(true);
      expect(result.attendeeReportStoredInS3).toBe(true);
      expect(result.attendeeReportParticipantCount).toBe(5);
    });
  });

  describe('loadSessionAttendeeImportCounts', () => {
    it('returns staging counts for unlinked sessions', async () => {
      const prisma = {
        zoomAttendanceParticipant: {
          groupBy: jest.fn().mockResolvedValue([
            { sessionId: 'sess-u', _count: { _all: 4 } },
          ]),
        },
        webinarParticipantEvent: {
          findMany: jest.fn(),
        },
      };

      const counts = await loadSessionAttendeeImportCounts(
        prisma as unknown as Parameters<typeof loadSessionAttendeeImportCounts>[0],
        [{ id: 'sess-u', programId: null, zoomMeetingId: '111' }],
      );

      expect(counts.get('sess-u')).toBe(4);
      expect(prisma.webinarParticipantEvent.findMany).not.toHaveBeenCalled();
    });

    it('returns REPORT_IMPORT counts for linked sessions', async () => {
      const prisma = {
        zoomAttendanceParticipant: {
          groupBy: jest.fn().mockResolvedValue([]),
        },
        webinarParticipantEvent: {
          findMany: jest.fn().mockResolvedValue([
            { programId: 'prog-1', zoomMeetingId: '222' },
            { programId: 'prog-1', zoomMeetingId: '222' },
          ]),
        },
      };

      const counts = await loadSessionAttendeeImportCounts(
        prisma as unknown as Parameters<typeof loadSessionAttendeeImportCounts>[0],
        [
          { id: 'sess-l', programId: 'prog-1', zoomMeetingId: '222' },
        ],
      );

      expect(counts.get('sess-l')).toBe(2);
      expect(prisma.webinarParticipantEvent.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            source: 'REPORT_IMPORT',
            event: 'JOINED',
          }),
        }),
      );
    });
  });
});
