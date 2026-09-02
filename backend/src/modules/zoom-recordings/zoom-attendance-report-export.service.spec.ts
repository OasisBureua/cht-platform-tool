import { ConfigService } from '@nestjs/config';
import { WebinarParticipantEventSource } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ZoomAttendanceReportExportService } from './zoom-attendance-report-export.service';
import { ZoomRecordingsStorageService } from './zoom-recordings-storage.service';

describe('ZoomAttendanceReportExportService', () => {
  let prisma: {
    zoomRecordingSession: { update: jest.Mock; findUnique: jest.Mock };
    webinarParticipantEvent: { findMany: jest.Mock };
  };
  let storage: {
    isStorageConfigured: jest.Mock;
    recordingsBucket: jest.Mock;
    uploadBuffer: jest.Mock;
  };
  let config: { get: jest.Mock };
  let service: ZoomAttendanceReportExportService;

  beforeEach(() => {
    prisma = {
      zoomRecordingSession: {
        update: jest.fn().mockResolvedValue({}),
        findUnique: jest.fn(),
      },
      webinarParticipantEvent: { findMany: jest.fn().mockResolvedValue([]) },
    };
    storage = {
      isStorageConfigured: jest.fn().mockReturnValue(true),
      recordingsBucket: jest.fn().mockReturnValue('session-assets-bucket'),
      uploadBuffer: jest.fn().mockResolvedValue(undefined),
    };
    config = {
      get: jest.fn((key: string) => {
        if (key === 'zoomRecordings.attendanceReportFilename') return 'attendees.csv';
        return undefined;
      }),
    };
    service = new ZoomAttendanceReportExportService(
      prisma as unknown as PrismaService,
      config as unknown as ConfigService,
      storage as unknown as ZoomRecordingsStorageService,
    );
  });

  it('uploads CSV under unlinked prefix when session has no program', async () => {
    const result = await service.exportFromZoomParticipants(
      { id: 'sess-1', zoomMeetingId: '999888777', programId: null },
      [
        {
          id: 'zp-1',
          name: 'Guest',
          userEmail: 'guest@test.com',
          joinTime: '2026-08-01T18:00:00Z',
          durationSeconds: 600,
        },
      ],
      'job-1',
    );

    expect(result.exported).toBe(true);
    expect(result.participantCount).toBe(1);
    expect(storage.uploadBuffer).toHaveBeenCalledWith(
      expect.objectContaining({
        key: 'zoom-recordings/unlinked/999888777/attendees.csv',
        contentType: 'text/csv; charset=utf-8',
      }),
    );
    expect(prisma.zoomRecordingSession.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'sess-1' },
        data: expect.objectContaining({
          attendeeReportS3Bucket: 'session-assets-bucket',
          attendeeReportParticipantCount: 1,
        }),
      }),
    );
  });

  it('does not fail when S3 is not configured', async () => {
    storage.isStorageConfigured.mockReturnValue(false);

    const result = await service.exportFromZoomParticipants(
      { id: 'sess-1', zoomMeetingId: '111', programId: null },
      [{ id: 'zp-1', joinTime: '2026-08-01T18:00:00Z' }],
    );

    expect(result.exported).toBe(false);
    expect(result.error).toContain('S3 not configured');
    expect(storage.uploadBuffer).not.toHaveBeenCalled();
  });

  it('reexports to program prefix after link', async () => {
    prisma.zoomRecordingSession.findUnique.mockResolvedValue({
      id: 'sess-1',
      zoomMeetingId: '83768449108',
      programId: 'prog-1',
    });
    prisma.webinarParticipantEvent.findMany.mockResolvedValue([
      {
        zoomParticipantId: 'zp-2',
        participantName: 'HCP',
        participantEmail: 'hcp@test.com',
        joinTime: new Date('2026-08-02T18:00:00Z'),
        leaveTime: null,
        durationSeconds: 1200,
        isHost: false,
        source: WebinarParticipantEventSource.REPORT_IMPORT,
        importJobId: 'job-1',
      },
    ]);

    const result = await service.reexportAfterLink('sess-1', 'prog-1');

    expect(result.exported).toBe(true);
    expect(storage.uploadBuffer).toHaveBeenCalledWith(
      expect.objectContaining({
        key: 'zoom-recordings/prog-1/83768449108/attendees.csv',
      }),
    );
    expect(prisma.webinarParticipantEvent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          programId: 'prog-1',
          source: WebinarParticipantEventSource.REPORT_IMPORT,
        }),
      }),
    );
  });
});
