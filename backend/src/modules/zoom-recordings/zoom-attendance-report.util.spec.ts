import {
  ATTENDANCE_REPORT_FILENAME,
  buildAttendanceReportS3Key,
  escapeCsvField,
  mapZoomParticipantsToReportRows,
  serializeAttendanceReportCsv,
} from './zoom-attendance-report.util';

describe('buildAttendanceReportS3Key', () => {
  it('uses programId when linked', () => {
    expect(
      buildAttendanceReportS3Key({
        programId: 'prog-1',
        meetingId: '83768449108',
      }),
    ).toBe(`zoom-recordings/prog-1/83768449108/${ATTENDANCE_REPORT_FILENAME}`);
  });

  it('uses unlinked when no programId', () => {
    expect(
      buildAttendanceReportS3Key({
        programId: null,
        meetingId: '999888777',
      }),
    ).toBe(`zoom-recordings/unlinked/999888777/${ATTENDANCE_REPORT_FILENAME}`);
  });
});

describe('escapeCsvField', () => {
  it('quotes fields with commas or quotes', () => {
    expect(escapeCsvField('Peltz, Brandon')).toBe('"Peltz, Brandon"');
    expect(escapeCsvField('say "hello"')).toBe('"say ""hello"""');
  });
});

describe('serializeAttendanceReportCsv', () => {
  it('writes header and rows with empty file for zero participants', () => {
    expect(serializeAttendanceReportCsv([])).toBe(
      'zoom_participant_id,participant_name,participant_email,join_time,leave_time,duration_seconds,is_host,source,import_job_id,exported_at\n',
    );
  });

  it('escapes special characters in participant names', () => {
    const csv = serializeAttendanceReportCsv([
      {
        zoomParticipantId: 'zp-1',
        participantName: 'Last, First',
        participantEmail: 'a@test.com',
        joinTime: '2026-08-01T18:00:00.000Z',
        leaveTime: null,
        durationSeconds: 600,
        isHost: false,
        source: 'REPORT_IMPORT',
        importJobId: 'job-1',
        exportedAt: '2026-08-31T12:00:00.000Z',
      },
    ]);
    expect(csv).toContain('"Last, First"');
    expect(csv).toContain('REPORT_IMPORT');
  });

  it('includes participants without a Zoom participant id', () => {
    const csv = serializeAttendanceReportCsv([
      {
        zoomParticipantId: '',
        participantName: 'No Id Guest',
        participantEmail: 'noid@test.com',
        joinTime: '2026-08-02T18:00:00.000Z',
        leaveTime: null,
        durationSeconds: 120,
        isHost: false,
        source: 'REPORT_IMPORT',
        importJobId: null,
        exportedAt: '2026-08-31T12:00:00.000Z',
      },
    ]);
    expect(csv).toContain('No Id Guest');
    expect(csv).toContain('noid@test.com');
    expect(csv.split('\n')[1]?.startsWith(',')).toBe(true);
  });
});

describe('mapZoomParticipantsToReportRows', () => {
  it('maps all importable participants including those without Zoom ids', () => {
    const exportedAt = new Date('2026-08-31T12:00:00.000Z');
    const rows = mapZoomParticipantsToReportRows(
      [
        {
          id: 'zp-1',
          name: 'With Id',
          userEmail: 'a@test.com',
          joinTime: '2026-08-01T18:00:00Z',
          durationSeconds: 60,
        },
        {
          id: null,
          name: 'No Id',
          userEmail: 'b@test.com',
          joinTime: '2026-08-01T18:05:00Z',
          durationSeconds: 120,
        },
      ],
      { exportedAt },
    );
    expect(rows).toHaveLength(2);
    expect(rows[0]?.zoomParticipantId).toBe('zp-1');
    expect(rows[1]?.zoomParticipantId).toBe('');
    expect(rows[1]?.participantEmail).toBe('b@test.com');
  });
});
