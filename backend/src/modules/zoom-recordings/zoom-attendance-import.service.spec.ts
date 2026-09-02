import { ConflictException } from '@nestjs/common';
import { ZoomAttendanceImportService } from './zoom-attendance-import.service';
import { ZoomAttendanceReportExportService } from './zoom-attendance-report-export.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { ZoomService } from '../webinars/zoom.service';
import { ProgramRegistrationsService } from '../programs/program-registrations.service';
import { ProgramZoomSessionType, WebinarParticipantEventSource } from '@prisma/client';

describe('ZoomAttendanceImportService', () => {
  let prisma: {
    zoomRecordingSession: {
      findUnique: jest.Mock;
      findMany: jest.Mock;
      count: jest.Mock;
      update: jest.Mock;
    };
    zoomAttendanceParticipant: {
      upsert: jest.Mock;
      findFirst: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      findMany: jest.Mock;
      deleteMany: jest.Mock;
      count: jest.Mock;
    };
    webinarParticipantEvent: {
      upsert: jest.Mock;
      findFirst: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      findMany: jest.Mock;
      count: jest.Mock;
    };
    user: { findUnique: jest.Mock };
    programRegistration: { findMany: jest.Mock };
    zoomAttendanceImportJob: { create: jest.Mock; findUnique: jest.Mock; update: jest.Mock; findFirst: jest.Mock };
    $transaction: jest.Mock;
  };
  let zoom: { isConfigured: jest.Mock; listReportParticipantsForSession: jest.Mock };
  let registrations: { autoVerifyAttendanceFromZoomJoins: jest.Mock };
  let reportExport: {
    exportFromZoomParticipants: jest.Mock;
    reexportAfterLink: jest.Mock;
  };
  let service: ZoomAttendanceImportService;

  beforeEach(() => {
    prisma = {
      zoomRecordingSession: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        update: jest.fn().mockResolvedValue({}),
      },
      zoomAttendanceParticipant: {
        upsert: jest.fn(),
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn(),
        update: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        deleteMany: jest.fn(),
        count: jest.fn(),
      },
      webinarParticipantEvent: {
        upsert: jest.fn(),
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn(),
        update: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn(),
      },
      user: { findUnique: jest.fn().mockResolvedValue(null) },
      programRegistration: { findMany: jest.fn().mockResolvedValue([]) },
      zoomAttendanceImportJob: {
        create: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        findFirst: jest.fn(),
      },
      $transaction: jest.fn(async (arg: unknown) => {
        if (typeof arg === 'function') {
          const tx = {
            zoomAttendanceParticipant: prisma.zoomAttendanceParticipant,
            webinarParticipantEvent: prisma.webinarParticipantEvent,
          };
          return (arg as (client: typeof tx) => Promise<unknown>)(tx);
        }
        return Promise.all(arg as Promise<unknown>[]);
      }),
    };
    zoom = {
      isConfigured: jest.fn().mockReturnValue(true),
      listReportParticipantsForSession: jest.fn(),
    };
    registrations = {
      autoVerifyAttendanceFromZoomJoins: jest.fn().mockResolvedValue({
        verifiedCount: 0,
        matchedRegistrationIds: [],
      }),
    };
    reportExport = {
      exportFromZoomParticipants: jest.fn().mockResolvedValue({
        exported: true,
        participantCount: 1,
      }),
      reexportAfterLink: jest.fn().mockResolvedValue({
        exported: true,
        participantCount: 0,
      }),
    };

    service = new ZoomAttendanceImportService(
      prisma as unknown as PrismaService,
      {
        get: jest.fn((key: string) => {
          if (key === 'zoomRecordings.attendanceImportMonthsBackDefault') return 12;
          if (key === 'zoomRecordings.attendanceImportAutoVerifyDefault') return false;
          return undefined;
        }),
      } as unknown as ConfigService,
      zoom as unknown as ZoomService,
      registrations as unknown as ProgramRegistrationsService,
      reportExport as unknown as ZoomAttendanceReportExportService,
    );
  });

  it('stages participants when session is not linked to a program', async () => {
    prisma.zoomRecordingSession.findUnique.mockResolvedValue({
      id: 'sess-1',
      zoomMeetingId: '111',
      zoomUuid: null,
      sessionType: ProgramZoomSessionType.WEBINAR,
      programId: null,
    });
    zoom.listReportParticipantsForSession.mockResolvedValue([
      {
        id: 'zp-1',
        name: 'Guest',
        userEmail: 'guest@test.com',
        joinTime: '2026-08-01T18:00:00Z',
        durationSeconds: 600,
      },
    ]);

    const result = await service.importSessionAttendees('sess-1');

    expect(result.participantsUpserted).toBe(1);
    expect(prisma.zoomAttendanceParticipant.create).toHaveBeenCalled();
    expect(prisma.webinarParticipantEvent.upsert).not.toHaveBeenCalled();
    expect(reportExport.exportFromZoomParticipants).toHaveBeenCalled();
    expect(prisma.zoomRecordingSession.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'sess-1' },
        data: expect.objectContaining({
          attendanceLastImportedAt: expect.any(Date),
        }),
      }),
    );
  });

  it('imports participants without Zoom ids using email + join time dedupe', async () => {
    prisma.zoomRecordingSession.findUnique.mockResolvedValue({
      id: 'sess-2',
      zoomMeetingId: '222',
      zoomUuid: null,
      sessionType: ProgramZoomSessionType.WEBINAR,
      programId: 'prog-1',
    });
    zoom.listReportParticipantsForSession.mockResolvedValue([
      {
        id: null,
        name: 'User',
        userEmail: 'david.gill@digitaledgepartner.com',
        joinTime: '2026-08-02T18:00:00Z',
        durationSeconds: 274,
      },
      {
        id: 'zp-2',
        name: 'HCP',
        userEmail: 'hcp@test.com',
        joinTime: '2026-08-02T18:05:00Z',
        durationSeconds: 1200,
      },
    ]);

    const result = await service.importSessionAttendees('sess-2');

    expect(result.participantsUpserted).toBe(2);
    expect(prisma.webinarParticipantEvent.upsert).toHaveBeenCalledTimes(1);
    expect(prisma.webinarParticipantEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          zoomParticipantId: null,
          participantEmail: 'david.gill@digitaledgepartner.com',
        }),
      }),
    );
  });

  it('re-import without Zoom id updates the same row (email + join time)', async () => {
    prisma.zoomRecordingSession.findUnique.mockResolvedValue({
      id: 'sess-2',
      zoomMeetingId: '222',
      zoomUuid: null,
      sessionType: ProgramZoomSessionType.WEBINAR,
      programId: 'prog-1',
    });
    zoom.listReportParticipantsForSession.mockResolvedValue([
      {
        id: null,
        name: 'User',
        userEmail: 'david.gill@digitaledgepartner.com',
        joinTime: '2026-08-02T18:00:00Z',
        durationSeconds: 300,
      },
    ]);
    prisma.webinarParticipantEvent.findFirst.mockResolvedValue({
      id: 'existing-row',
    });

    const result = await service.importSessionAttendees('sess-2');

    expect(result.participantsUpserted).toBe(1);
    expect(prisma.webinarParticipantEvent.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'existing-row' },
        data: expect.objectContaining({ durationSeconds: 300 }),
      }),
    );
    expect(prisma.webinarParticipantEvent.create).not.toHaveBeenCalled();
  });

  it('writes WebinarParticipantEvent when session is linked', async () => {
    prisma.zoomRecordingSession.findUnique.mockResolvedValue({
      id: 'sess-2',
      zoomMeetingId: '222',
      zoomUuid: null,
      sessionType: ProgramZoomSessionType.WEBINAR,
      programId: 'prog-1',
    });
    zoom.listReportParticipantsForSession.mockResolvedValue([
      {
        id: 'zp-2',
        name: 'HCP',
        userEmail: 'hcp@test.com',
        joinTime: '2026-08-02T18:00:00Z',
        durationSeconds: 1200,
      },
    ]);

    await service.importSessionAttendees('sess-2');

    expect(prisma.webinarParticipantEvent.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          programId_zoomParticipantId_event_source_joinTime: expect.objectContaining({
            source: WebinarParticipantEventSource.REPORT_IMPORT,
          }),
        }),
      }),
    );
  });

  it('paginates staged attendees with default page size 10', async () => {
    prisma.zoomRecordingSession.findUnique.mockResolvedValue({
      id: 'sess-1',
      programId: null,
      zoomMeetingId: '111',
    });
    prisma.zoomAttendanceParticipant.count.mockResolvedValue(25);
    prisma.zoomAttendanceParticipant.findMany.mockResolvedValue([
      {
        id: 'row-1',
        zoomParticipantId: 'zp-1',
        participantName: 'Guest',
        participantEmail: 'guest@test.com',
        joinTime: new Date('2026-08-01T18:00:00Z'),
        leaveTime: null,
        durationSeconds: 600,
        isHost: false,
      },
    ]);

    const result = await service.listSessionAttendees('sess-1', { page: 2, pageSize: 10 });

    expect(result.page).toBe(2);
    expect(result.pageSize).toBe(10);
    expect(result.total).toBe(25);
    expect(result.search).toBeNull();
    expect(result.participants).toHaveLength(1);
    expect(prisma.zoomAttendanceParticipant.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 10, take: 10 }),
    );
  });

  it('filters staged attendees by search across all pages before paginating', async () => {
    prisma.zoomRecordingSession.findUnique.mockResolvedValue({
      id: 'sess-1',
      programId: null,
      zoomMeetingId: '111',
    });
    prisma.zoomAttendanceParticipant.count.mockResolvedValue(1);
    prisma.zoomAttendanceParticipant.findMany.mockResolvedValue([
      {
        id: 'row-9',
        zoomParticipantId: '16778240',
        participantName: 'Deep Page Guest',
        participantEmail: 'deep@test.com',
        joinTime: new Date('2026-08-09T18:00:00Z'),
        leaveTime: null,
        durationSeconds: 300,
        isHost: false,
      },
    ]);

    const result = await service.listSessionAttendees('sess-1', {
      page: 1,
      pageSize: 10,
      search: '16778240',
    });

    expect(result.total).toBe(1);
    expect(result.participants[0]?.zoomParticipantId).toBe('16778240');
    expect(prisma.zoomAttendanceParticipant.count).toHaveBeenCalledWith({
      where: expect.objectContaining({
        AND: [
          { sessionId: 'sess-1' },
          {
            OR: [
              { participantName: { contains: '16778240', mode: 'insensitive' } },
              { participantEmail: { contains: '16778240', mode: 'insensitive' } },
              { zoomParticipantId: { contains: '16778240', mode: 'insensitive' } },
            ],
          },
        ],
      }),
    });
    expect(prisma.zoomAttendanceParticipant.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 0, take: 10 }),
    );
  });

  it('clamps page when search narrows results below the requested page', async () => {
    prisma.zoomRecordingSession.findUnique.mockResolvedValue({
      id: 'sess-1',
      programId: null,
      zoomMeetingId: '111',
    });
    prisma.zoomAttendanceParticipant.count.mockResolvedValue(2);
    prisma.zoomAttendanceParticipant.findMany.mockResolvedValue([]);

    const result = await service.listSessionAttendees('sess-1', {
      page: 5,
      pageSize: 10,
      search: 'alice',
    });

    expect(result.page).toBe(1);
    expect(result.total).toBe(2);
    expect(prisma.zoomAttendanceParticipant.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 0, take: 10 }),
    );
  });

  it('ignores blank search terms', async () => {
    prisma.zoomRecordingSession.findUnique.mockResolvedValue({
      id: 'sess-1',
      programId: null,
      zoomMeetingId: '111',
    });
    prisma.zoomAttendanceParticipant.count.mockResolvedValue(0);
    prisma.zoomAttendanceParticipant.findMany.mockResolvedValue([]);

    await service.listSessionAttendees('sess-1', { search: '   ' });

    expect(prisma.zoomAttendanceParticipant.count).toHaveBeenCalledWith({
      where: { sessionId: 'sess-1' },
    });
  });

  it('rejects bulk import when no catalog sessions match the date window', async () => {
    prisma.zoomRecordingSession.count.mockResolvedValue(0);

    await expect(service.startImport({})).rejects.toThrow(ConflictException);
    expect(prisma.zoomAttendanceImportJob.create).not.toHaveBeenCalled();
  });
});
