import { NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { ZoomService } from '../webinars/zoom.service';
import { ZoomAttendanceImportService } from './zoom-attendance-import.service';
import { ZoomRecordingsCatalogService } from './zoom-recordings-catalog.service';
import { ZoomRecordingsPullService } from './zoom-recordings-pull.service';
import { ZoomRecordingsStorageService } from './zoom-recordings-storage.service';

describe('ZoomRecordingsCatalogService', () => {
  let prisma: { zoomRecordingSession: { findUnique: jest.Mock } };
  let storage: { createPresignedObjectDownloadUrl: jest.Mock };
  let config: { get: jest.Mock };
  let service: ZoomRecordingsCatalogService;

  beforeEach(() => {
    prisma = { zoomRecordingSession: { findUnique: jest.fn() } };
    storage = {
      createPresignedObjectDownloadUrl: jest.fn().mockResolvedValue({
        url: 'https://s3.example/presigned',
        expiresInSeconds: 900,
      }),
    };
    config = {
      get: jest.fn((key: string) => {
        if (key === 'zoomRecordings.attendanceReportFilename') return 'attendees.csv';
        return undefined;
      }),
    };
    service = new ZoomRecordingsCatalogService(
      prisma as unknown as PrismaService,
      config as unknown as ConfigService,
      {} as ZoomService,
      storage as unknown as ZoomRecordingsStorageService,
      {} as ZoomRecordingsPullService,
      {} as ZoomAttendanceImportService,
    );
  });

  describe('createAttendanceReportDownloadUrl', () => {
    it('returns a presigned URL when the report is stored in S3', async () => {
      const exportedAt = new Date('2026-08-01T12:00:00.000Z');
      prisma.zoomRecordingSession.findUnique.mockResolvedValue({
        attendeeReportS3Bucket: 'session-assets-bucket',
        attendeeReportS3Key: 'zoom-recordings/unlinked/999888777/attendees.csv',
        attendeeReportParticipantCount: 5,
        attendeeReportExportedAt: exportedAt,
        zoomMeetingId: '999888777',
      });

      const result = await service.createAttendanceReportDownloadUrl('sess-1');

      expect(result).toEqual({
        url: 'https://s3.example/presigned',
        expiresInSeconds: 900,
        filename: 'attendees.csv',
        participantCount: 5,
        exportedAt: exportedAt.toISOString(),
        zoomMeetingId: '999888777',
      });
      expect(storage.createPresignedObjectDownloadUrl).toHaveBeenCalledWith({
        bucket: 'session-assets-bucket',
        key: 'zoom-recordings/unlinked/999888777/attendees.csv',
        contentType: 'text/csv; charset=utf-8',
        filename: 'attendees.csv',
        disposition: 'attachment',
      });
    });

    it('throws when the session is not found', async () => {
      prisma.zoomRecordingSession.findUnique.mockResolvedValue(null);

      await expect(
        service.createAttendanceReportDownloadUrl('missing'),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws when the report has not been exported to S3 yet', async () => {
      prisma.zoomRecordingSession.findUnique.mockResolvedValue({
        attendeeReportS3Bucket: null,
        attendeeReportS3Key: null,
        attendeeReportParticipantCount: null,
        attendeeReportExportedAt: null,
        zoomMeetingId: '999888777',
      });

      await expect(
        service.createAttendanceReportDownloadUrl('sess-1'),
      ).rejects.toThrow(
        'Attendee report is not stored in S3 yet. Import attendees first.',
      );
    });
  });
});
