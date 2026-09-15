import { NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { ZoomService } from '../webinars/zoom.service';
import { ZoomAttendanceImportService } from './zoom-attendance-import.service';
import { ZoomRecordingsCatalogService } from './zoom-recordings-catalog.service';
import { ZoomRecordingsPullService } from './zoom-recordings-pull.service';
import { ZoomRecordingsStorageService } from './zoom-recordings-storage.service';

describe('ZoomRecordingsCatalogService', () => {
  let prisma: {
    zoomRecordingSession: { findUnique: jest.Mock };
    survey: { findMany: jest.Mock };
  };
  let storage: { createPresignedObjectDownloadUrl: jest.Mock };
  let config: { get: jest.Mock };
  let service: ZoomRecordingsCatalogService;

  beforeEach(() => {
    prisma = {
      zoomRecordingSession: { findUnique: jest.fn() },
      survey: { findMany: jest.fn() },
    };
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

  describe('listSessionSurveys', () => {
    it('returns disabled payload when the session is not linked to a Program', async () => {
      prisma.zoomRecordingSession.findUnique.mockResolvedValue({
        id: 'sess-1',
        programId: null,
        program: null,
      });

      const result = await service.listSessionSurveys('sess-1');

      expect(result).toMatchObject({
        linked: false,
        canFetchSurveys: false,
        reason: 'Link this session to a Program to fetch and view surveys.',
        surveys: [],
        legacyForms: [],
      });
      expect(prisma.survey.findMany).not.toHaveBeenCalled();
    });

    it('returns surveys for a linked Program', async () => {
      prisma.zoomRecordingSession.findUnique.mockResolvedValue({
        id: 'sess-1',
        programId: 'prog-1',
        program: {
          id: 'prog-1',
          title: 'Demo Webinar',
          jotformIntakeFormUrl: null,
          jotformSurveyUrl: null,
        },
      });
      prisma.survey.findMany.mockResolvedValue([
        {
          id: 'survey-1',
          title: 'Intake',
          type: 'INTAKE',
          jotformFormId: null,
          isCustomized: false,
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
          _count: { responses: 3 },
          responses: [{ submittedAt: new Date('2026-01-02T00:00:00.000Z') }],
        },
        {
          id: 'survey-2',
          title: 'Feedback',
          type: 'FEEDBACK',
          jotformFormId: 'abc123',
          isCustomized: true,
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
          _count: { responses: 0 },
          responses: [],
        },
      ]);

      const result = await service.listSessionSurveys('sess-1');

      expect(result.linked).toBe(true);
      expect(result.canFetchSurveys).toBe(true);
      expect(result.programId).toBe('prog-1');
      expect(result.surveys).toHaveLength(2);
      expect(result.surveys[0]).toMatchObject({
        id: 'survey-1',
        source: 'native',
        responseCount: 3,
      });
      expect(result.surveys[1]).toMatchObject({
        id: 'survey-2',
        source: 'jotform',
        jotformFormUrl: 'https://communityhealthmedia.jotform.com/abc123',
      });
    });

    it('throws when the session is not found', async () => {
      prisma.zoomRecordingSession.findUnique.mockResolvedValue(null);
      await expect(service.listSessionSurveys('missing')).rejects.toThrow(
        NotFoundException,
      );
    });
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
