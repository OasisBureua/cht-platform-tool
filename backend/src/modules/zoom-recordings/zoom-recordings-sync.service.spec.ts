import { ConfigService } from '@nestjs/config';
import { ProgramZoomSessionType, ZoomSyncJobStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ZoomService } from '../webinars/zoom.service';
import { ZoomRecordingsSessionService } from './zoom-recordings-session.service';
import { ZoomRecordingsSyncService } from './zoom-recordings-sync.service';

describe('ZoomRecordingsSyncService per-user inventory', () => {
  function makeService(opts: {
    listAllAccountUsers: jest.Mock;
    listUserRecordingsInRange: jest.Mock;
    ensureSessionFromSync: jest.Mock;
    upsertFileStub: jest.Mock;
    findProgramByZoomMeetingId: jest.Mock;
  }) {
    const jobs: Array<Record<string, unknown>> = [];
    const prisma = {
      zoomSyncJob: {
        create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
          const job = {
            id: 'job-1',
            status: ZoomSyncJobStatus.QUEUED,
            ...data,
          };
          jobs.push(job);
          return job;
        }),
        findUnique: jest.fn(async ({ where }: { where: { id: string } }) =>
          jobs.find((j) => j.id === where.id) ?? {
            id: where.id,
            status: ZoomSyncJobStatus.QUEUED,
            fromDate: new Date('2026-08-01T00:00:00.000Z'),
            toDate: new Date('2026-08-31T00:00:00.000Z'),
            startedAt: null,
          },
        ),
        update: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
          Object.assign(jobs[0] ?? {}, data);
          return jobs[0];
        }),
      },
    };

    const zoom = {
      isConfigured: () => true,
      listAllAccountUsers: opts.listAllAccountUsers,
      listUserRecordingsInRange: opts.listUserRecordingsInRange,
    };

    const sessions = {
      findProgramByZoomMeetingId: opts.findProgramByZoomMeetingId,
      ensureSessionFromSync: opts.ensureSessionFromSync,
      upsertFileStub: opts.upsertFileStub,
    };

    const config = {
      get: jest.fn(() => 1),
    };

    const service = new ZoomRecordingsSyncService(
      prisma as unknown as PrismaService,
      config as unknown as ConfigService,
      zoom as unknown as ZoomService,
      sessions as unknown as ZoomRecordingsSessionService,
    );

    return { service, prisma };
  }

  it('inventories recordings via GET /users then per-user recordings', async () => {
    const listAllAccountUsers = jest.fn().mockResolvedValue([
      { id: 'host-1', email: 'host@example.com' },
    ]);
    const listUserRecordingsInRange = jest.fn().mockResolvedValue([
      {
        id: '111',
        uuid: 'uuid-1',
        topic: 'Recorded webinar',
        startTime: '2026-08-10T18:00:00Z',
        duration: 45,
        hostEmail: '',
        totalSize: 10,
        recordingFiles: [
          { id: 'file-1', fileType: 'MP4', fileExtension: 'mp4', fileSize: 10 },
        ],
      },
    ]);
    const ensureSessionFromSync = jest.fn().mockResolvedValue({ id: 'sess-1' });
    const upsertFileStub = jest.fn().mockResolvedValue({});
    const findProgramByZoomMeetingId = jest.fn().mockResolvedValue(null);

    const { service, prisma } = makeService({
      listAllAccountUsers,
      listUserRecordingsInRange,
      ensureSessionFromSync,
      upsertFileStub,
      findProgramByZoomMeetingId,
    });

    await service.runJob('job-1');

    expect(listAllAccountUsers).toHaveBeenCalledWith({ status: 'active' });
    expect(listUserRecordingsInRange).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'host-1' }),
    );
    expect(ensureSessionFromSync).toHaveBeenCalledWith(
      expect.objectContaining({
        meetingId: '111',
        hostEmail: 'host@example.com',
        sessionType: ProgramZoomSessionType.WEBINAR,
      }),
    );
    expect(upsertFileStub).toHaveBeenCalledWith(
      expect.objectContaining({ zoomRecordingFileId: 'file-1' }),
    );
    expect(prisma.zoomSyncJob.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          progressJson: expect.objectContaining({
            usersTotal: 1,
            windowsDone: expect.any(Number),
            windowsTotal: expect.any(Number),
          }),
        }),
      }),
    );
    expect(prisma.zoomSyncJob.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: ZoomSyncJobStatus.COMPLETED }),
      }),
    );
  });

  it('does not call account-wide recordings API', async () => {
    const listAllAccountUsers = jest.fn().mockResolvedValue([]);
    const listUserRecordingsInRange = jest.fn();
    const { service, prisma } = makeService({
      listAllAccountUsers,
      listUserRecordingsInRange,
      ensureSessionFromSync: jest.fn(),
      upsertFileStub: jest.fn(),
      findProgramByZoomMeetingId: jest.fn(),
    });

    await service.runJob('job-1');

    expect(listUserRecordingsInRange).not.toHaveBeenCalled();
    expect(prisma.zoomSyncJob.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: ZoomSyncJobStatus.COMPLETED,
          errorMessage: 'No active Zoom users returned; nothing to inventory.',
        }),
      }),
    );
  });

  it('fails the job when listing users is denied', async () => {
    const listAllAccountUsers = jest.fn().mockRejectedValue({
      message: 'Request failed',
      response: {
        status: 400,
        data: {
          code: 4711,
          message:
            'Invalid access token, does not contain scopes:[user:read:list_users:admin].',
        },
      },
    });
    const { service, prisma } = makeService({
      listAllAccountUsers,
      listUserRecordingsInRange: jest.fn(),
      ensureSessionFromSync: jest.fn(),
      upsertFileStub: jest.fn(),
      findProgramByZoomMeetingId: jest.fn(),
    });

    await service.runJob('job-1');

    expect(prisma.zoomSyncJob.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: ZoomSyncJobStatus.FAILED,
          errorMessage: expect.stringContaining(
            'user:read:list_users:admin',
          ),
        }),
      }),
    );
  });

  it('continues other hosts when one window fails', async () => {
    const listAllAccountUsers = jest.fn().mockResolvedValue([
      { id: 'host-1', email: 'one@example.com' },
      { id: 'host-2', email: 'two@example.com' },
    ]);
    const listUserRecordingsInRange = jest
      .fn()
      .mockRejectedValueOnce(new Error('Zoom 403 for host-1'))
      .mockResolvedValueOnce([
        {
          id: '222',
          uuid: 'uuid-2',
          topic: 'Other host',
          recordingFiles: [],
        },
      ]);
    const ensureSessionFromSync = jest.fn().mockResolvedValue({ id: 'sess-2' });
    const { service, prisma } = makeService({
      listAllAccountUsers,
      listUserRecordingsInRange,
      ensureSessionFromSync,
      upsertFileStub: jest.fn(),
      findProgramByZoomMeetingId: jest.fn().mockResolvedValue(null),
    });

    await service.runJob('job-1');

    expect(ensureSessionFromSync).toHaveBeenCalledTimes(1);
    expect(prisma.zoomSyncJob.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: ZoomSyncJobStatus.COMPLETED,
          progressJson: expect.objectContaining({
            sessionsUpserted: 1,
            errors: expect.arrayContaining([
              expect.stringContaining('one@example.com'),
            ]),
          }),
        }),
      }),
    );
  });

  it('keeps later sessions in a window when one upsert fails', async () => {
    const listAllAccountUsers = jest.fn().mockResolvedValue([
      { id: 'host-1', email: 'host@example.com' },
    ]);
    const listUserRecordingsInRange = jest.fn().mockResolvedValue([
      { id: 'bad', topic: 'Broken', recordingFiles: [] },
      {
        id: 'good',
        topic: 'Ok',
        recordingFiles: [{ id: 'file-ok', fileType: 'MP4' }],
      },
    ]);
    const ensureSessionFromSync = jest
      .fn()
      .mockRejectedValueOnce(new Error('db unique'))
      .mockResolvedValueOnce({ id: 'sess-good' });
    const upsertFileStub = jest.fn().mockResolvedValue({});
    const { service } = makeService({
      listAllAccountUsers,
      listUserRecordingsInRange,
      ensureSessionFromSync,
      upsertFileStub,
      findProgramByZoomMeetingId: jest.fn().mockResolvedValue(null),
    });

    await service.runJob('job-1');

    expect(ensureSessionFromSync).toHaveBeenCalledTimes(2);
    expect(upsertFileStub).toHaveBeenCalledWith(
      expect.objectContaining({ zoomRecordingFileId: 'file-ok' }),
    );
  });

  it('skips sessions and files with no id', async () => {
    const listAllAccountUsers = jest.fn().mockResolvedValue([
      { id: 'host-1', email: 'host@example.com' },
    ]);
    const listUserRecordingsInRange = jest.fn().mockResolvedValue([
      { id: '', topic: 'Missing meeting id', recordingFiles: [{ id: 'f1' }] },
      {
        id: '333',
        topic: 'Has files',
        recordingFiles: [
          { id: '', fileType: 'MP4' },
          { id: 'file-2', fileType: 'MP4' },
        ],
      },
    ]);
    const ensureSessionFromSync = jest.fn().mockResolvedValue({ id: 'sess-3' });
    const upsertFileStub = jest.fn().mockResolvedValue({});
    const { service } = makeService({
      listAllAccountUsers,
      listUserRecordingsInRange,
      ensureSessionFromSync,
      upsertFileStub,
      findProgramByZoomMeetingId: jest.fn().mockResolvedValue(null),
    });

    await service.runJob('job-1');

    expect(ensureSessionFromSync).toHaveBeenCalledTimes(1);
    expect(ensureSessionFromSync).toHaveBeenCalledWith(
      expect.objectContaining({ meetingId: '333' }),
    );
    expect(upsertFileStub).toHaveBeenCalledTimes(1);
    expect(upsertFileStub).toHaveBeenCalledWith(
      expect.objectContaining({ zoomRecordingFileId: 'file-2' }),
    );
  });

  it('caps stored window errors and still completes', async () => {
    const hosts = Array.from({ length: 42 }, (_, i) => ({
      id: `host-${i}`,
      email: `h${i}@example.com`,
    }));
    const listAllAccountUsers = jest.fn().mockResolvedValue(hosts);
    const listUserRecordingsInRange = jest
      .fn()
      .mockRejectedValue(new Error('boom'));
    const { service, prisma } = makeService({
      listAllAccountUsers,
      listUserRecordingsInRange,
      ensureSessionFromSync: jest.fn(),
      upsertFileStub: jest.fn(),
      findProgramByZoomMeetingId: jest.fn(),
    });

    await service.runJob('job-1');

    expect(prisma.zoomSyncJob.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: ZoomSyncJobStatus.COMPLETED,
          progressJson: expect.objectContaining({
            errors: expect.arrayContaining([
              'Additional host/window errors omitted.',
            ]),
          }),
        }),
      }),
    );
    const completed = (prisma.zoomSyncJob.update as jest.Mock).mock.calls.find(
      (call: Array<{ data?: { progressJson?: { errors?: string[] } } }>) =>
        call[0]?.data?.progressJson?.errors?.includes(
          'Additional host/window errors omitted.',
        ),
    );
    expect(completed?.[0].data.progressJson.errors).toHaveLength(41);
  });
});
