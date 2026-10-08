import { ExportService, rollupAttendance } from './export.service';
import type { PrismaService } from '../../prisma/prisma.service';
import type { JotformService } from '../jotform/jotform.service';

describe('ExportService.getCampaignInputPacket', () => {
  const campaignId = 'AZ-25-01_LIV001';
  const requestId = 'req-test-1';

  function normalizeProgram(raw: Record<string, unknown>) {
    return {
      zoomPanelistLinks: null,
      programRegistrations: [],
      ...raw,
      webinarParticipantEvents: (
        (raw.webinarParticipantEvents as Array<Record<string, unknown>>) ?? []
      ).map((ev) => ({ isHost: false, ...ev })),
    };
  }

  function buildService(
    programs: Record<string, unknown>[],
    listFormSubmissions: jest.Mock = jest.fn().mockResolvedValue([]),
    users: unknown[] = [],
  ) {
    const findMany = jest
      .fn()
      .mockResolvedValue(programs.map((p) => normalizeProgram(p)));
    const userFindMany = jest.fn().mockResolvedValue(users);
    const prisma = {
      program: { findMany },
      user: { findMany: userFindMany },
    } as unknown as PrismaService;
    const jotform = {
      listFormSubmissions,
    } as unknown as JotformService;
    return {
      service: new ExportService(prisma, jotform),
      findMany,
      userFindMany,
      listFormSubmissions,
    };
  }

  it('queries only Programs with the given campaignId', async () => {
    const { service, findMany } = buildService([]);
    await service.getCampaignInputPacket(campaignId, requestId);
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { campaignId },
      }),
    );
  });

  it('returns empty arrays when no programs are linked', async () => {
    const { service } = buildService([]);
    const packet = await service.getCampaignInputPacket(campaignId, requestId);
    expect(packet.campaignId).toBe(campaignId);
    expect(packet.requestId).toBe(requestId);
    expect(packet.sessions).toEqual([]);
    expect(packet.attendance).toEqual([]);
    expect(packet.registrations).toEqual([]);
    expect(packet.surveys).toEqual([]);
  });

  it('builds a session with transcriptStatus missing when Zoom is not pulled', async () => {
    const start = new Date('2026-09-01T15:00:00.000Z');
    const { service } = buildService([
      {
        id: 'prog-1',
        title: 'Live session',
        zoomSessionType: 'WEBINAR',
        startDate: start,
        zoomMeetingId: '999',
        chmProgramId: null,
        campaignId,
        zoomRecordingSessions: [],
        webinarParticipantEvents: [],
        surveys: [],
      },
    ]);

    const packet = await service.getCampaignInputPacket(campaignId, requestId);
    expect(packet.sessions).toHaveLength(1);
    expect(packet.sessions[0]).toMatchObject({
      platformToolProgramId: 'prog-1',
      campaignId,
      kind: 'WEBINAR',
      title: 'Live session',
      sessionDate: start.toISOString(),
      zoomMeetingId: '999',
      zoomMeetingUuid: null,
      transcriptS3Key: null,
      transcriptStatus: 'missing',
    });
  });

  it('sets transcriptStatus ok when a COMPLETED TRANSCRIPT file has an s3Key', async () => {
    const s3Key = 'zoom-recordings/prog-1/999/file-1.vtt';
    const { service } = buildService([
      {
        id: 'prog-1',
        title: 'Live session',
        zoomSessionType: 'WEBINAR',
        startDate: new Date('2026-09-01T15:00:00.000Z'),
        zoomMeetingId: '999',
        chmProgramId: 'CHM-1',
        campaignId,
        zoomRecordingSessions: [
          {
            zoomMeetingId: '999',
            zoomUuid: 'uuid-abc',
            startTime: new Date('2026-09-01T15:00:00.000Z'),
            files: [
              {
                fileType: 'TRANSCRIPT',
                pullStatus: 'COMPLETED',
                s3Key,
              },
            ],
          },
        ],
        webinarParticipantEvents: [],
        surveys: [],
      },
    ]);

    const packet = await service.getCampaignInputPacket(campaignId, requestId);
    expect(packet.sessions[0]).toMatchObject({
      transcriptS3Key: s3Key,
      transcriptStatus: 'ok',
      zoomMeetingUuid: 'uuid-abc',
      chmProgramId: 'CHM-1',
    });
  });

  it('prefers TRANSCRIPT over CC when both are pulled', async () => {
    const { service } = buildService([
      {
        id: 'prog-1',
        title: 'Live session',
        zoomSessionType: 'WEBINAR',
        startDate: null,
        zoomMeetingId: '999',
        chmProgramId: null,
        campaignId,
        zoomRecordingSessions: [
          {
            zoomMeetingId: '999',
            zoomUuid: null,
            startTime: null,
            files: [
              {
                fileType: 'CC',
                pullStatus: 'COMPLETED',
                s3Key: 'zoom-recordings/prog-1/999/cc.vtt',
              },
              {
                fileType: 'TRANSCRIPT',
                pullStatus: 'COMPLETED',
                s3Key: 'zoom-recordings/prog-1/999/transcript.vtt',
              },
            ],
          },
        ],
        webinarParticipantEvents: [],
        surveys: [],
      },
    ]);

    const packet = await service.getCampaignInputPacket(campaignId, requestId);
    expect(packet.sessions[0].transcriptS3Key).toBe(
      'zoom-recordings/prog-1/999/transcript.vtt',
    );
    expect(packet.sessions[0].transcriptStatus).toBe('ok');
  });

  it('sums REPORT_IMPORT rejoin segments and skips webhook when import exists', async () => {
    const submittedAt = new Date('2026-09-02T12:00:00.000Z');
    const { service } = buildService([
      {
        id: 'prog-1',
        title: 'Live session',
        zoomSessionType: 'WEBINAR',
        startDate: null,
        zoomMeetingId: null,
        chmProgramId: null,
        campaignId,
        zoomRecordingSessions: [],
        webinarParticipantEvents: [
          {
            participantEmail: 'a@example.com',
            userId: 'u1',
            joinTime: new Date('2026-09-01T15:01:00.000Z'),
            leaveTime: null,
            durationSeconds: 60,
            source: 'REPORT_IMPORT',
            occurredAt: new Date('2026-09-01T15:01:00.000Z'),
            isHost: false,
          },
          {
            participantEmail: 'A@example.com',
            userId: 'u1',
            joinTime: new Date('2026-09-01T15:10:00.000Z'),
            leaveTime: null,
            durationSeconds: 30,
            source: 'REPORT_IMPORT',
            occurredAt: new Date('2026-09-01T15:10:00.000Z'),
            isHost: false,
          },
          {
            participantEmail: 'a@example.com',
            userId: 'u1',
            joinTime: new Date('2026-09-01T15:05:00.000Z'),
            leaveTime: null,
            durationSeconds: 999,
            source: 'WEBHOOK',
            occurredAt: new Date('2026-09-01T15:05:00.000Z'),
            isHost: false,
          },
        ],
        programRegistrations: [
          {
            userId: 'u1',
            status: 'APPROVED',
            createdAt: new Date('2026-08-01T00:00:00.000Z'),
            user: {
              id: 'u1',
              email: 'a@example.com',
              specialty: 'Cardiology',
              institution: 'CHM Clinic',
            },
          },
        ],
        surveys: [
          {
            id: 'survey-1',
            type: 'FEEDBACK',
            title: 'Feedback',
            jotformFormId: null,
            responses: [
              {
                userId: 'u1',
                submittedAt,
                score: 4,
                schemaVersion: 1,
                answers: { q1: 'yes' },
                submissionId: 'native-sub-1',
              },
            ],
          },
        ],
      },
    ]);

    const packet = await service.getCampaignInputPacket(
      `  ${campaignId}  `,
      requestId,
    );
    expect(packet.campaignId).toBe(campaignId);
    expect(packet.attendance).toHaveLength(1);
    expect(packet.attendance[0]).toMatchObject({
      participantEmail: 'a@example.com',
      durationSeconds: 90,
      specialty: 'Cardiology',
      institution: 'CHM Clinic',
      source: 'REPORT_IMPORT',
    });
    expect(packet.attendance[0]).not.toHaveProperty('participantName');
    expect(packet.registrations).toEqual([
      {
        platformToolProgramId: 'prog-1',
        userId: 'u1',
        registeredAt: '2026-08-01T00:00:00.000Z',
        status: 'APPROVED',
        specialty: 'Cardiology',
        institution: 'CHM Clinic',
      },
    ]);
    expect(packet.surveys).toHaveLength(1);
    expect(packet.surveys[0]).toMatchObject({
      surveyId: 'survey-1',
      type: 'FEEDBACK',
      jotformFormId: null,
      source: 'native',
      responseCount: 1,
    });
  });

  it('excludes hosts and panelists from attendance', async () => {
    const { service } = buildService([
      {
        id: 'prog-1',
        title: 'Live session',
        zoomSessionType: 'WEBINAR',
        startDate: null,
        zoomMeetingId: null,
        chmProgramId: null,
        campaignId,
        zoomPanelistLinks: [
          { name: 'Panel', email: 'panel@example.com', joinUrl: 'https://x' },
        ],
        zoomRecordingSessions: [],
        webinarParticipantEvents: [
          {
            participantEmail: 'host@example.com',
            userId: null,
            joinTime: new Date('2026-09-01T15:00:00.000Z'),
            leaveTime: null,
            durationSeconds: 600,
            source: 'REPORT_IMPORT',
            occurredAt: new Date('2026-09-01T15:00:00.000Z'),
            isHost: true,
          },
          {
            participantEmail: 'panel@example.com',
            userId: null,
            joinTime: new Date('2026-09-01T15:00:00.000Z'),
            leaveTime: null,
            durationSeconds: 600,
            source: 'REPORT_IMPORT',
            occurredAt: new Date('2026-09-01T15:00:00.000Z'),
            isHost: false,
          },
          {
            participantEmail: 'hcp@example.com',
            userId: 'u9',
            joinTime: new Date('2026-09-01T15:00:00.000Z'),
            leaveTime: null,
            durationSeconds: 120,
            source: 'REPORT_IMPORT',
            occurredAt: new Date('2026-09-01T15:00:00.000Z'),
            isHost: false,
          },
        ],
        surveys: [],
      },
    ]);

    const packet = await service.getCampaignInputPacket(campaignId, requestId);
    expect(packet.attendance).toHaveLength(1);
    expect(packet.attendance[0].participantEmail).toBe('hcp@example.com');
    expect(packet.attendance[0].durationSeconds).toBe(120);
  });

  it('skips REJECTED registrations', async () => {
    const { service } = buildService([
      {
        id: 'prog-1',
        title: 'Live session',
        zoomSessionType: 'WEBINAR',
        startDate: null,
        zoomMeetingId: null,
        chmProgramId: null,
        campaignId,
        zoomRecordingSessions: [],
        webinarParticipantEvents: [],
        programRegistrations: [
          {
            userId: 'u-ok',
            status: 'PENDING',
            createdAt: new Date('2026-08-01T00:00:00.000Z'),
            user: {
              id: 'u-ok',
              email: 'ok@example.com',
              specialty: null,
              institution: null,
            },
          },
        ],
        surveys: [],
      },
    ]);

    // Prisma where filters REJECTED; fixture only returns non-rejected.
    const packet = await service.getCampaignInputPacket(campaignId, requestId);
    expect(packet.registrations).toHaveLength(1);
    expect(packet.registrations[0].userId).toBe('u-ok');
  });

  it('marks a survey jotform when jotformFormId is set', async () => {
    const submittedAt = new Date('2026-09-02T12:00:00.000Z');
    const { service } = buildService([
      {
        id: 'prog-1',
        title: 'Live session',
        zoomSessionType: 'WEBINAR',
        startDate: null,
        zoomMeetingId: null,
        chmProgramId: null,
        campaignId,
        zoomRecordingSessions: [],
        webinarParticipantEvents: [],
        surveys: [
          {
            id: 'survey-jot',
            type: 'POST_TEST',
            title: 'Post',
            jotformFormId: '  jf-99  ',
            responses: [
              {
                userId: 'u2',
                submittedAt,
                score: null,
                schemaVersion: 2,
                answers: { q1: 'no' },
                submissionId: '  jf-sub-1  ',
              },
            ],
          },
          {
            id: 'survey-blank',
            type: 'INTAKE',
            title: 'Intake',
            jotformFormId: '   ',
            responses: [
              {
                userId: 'u3',
                submittedAt,
                score: null,
                schemaVersion: 1,
                answers: {},
                submissionId: '  ',
              },
            ],
          },
        ],
      },
    ]);

    const packet = await service.getCampaignInputPacket(campaignId, requestId);
    expect(packet.surveys[0]).toMatchObject({
      surveyId: 'survey-jot',
      type: 'POST_TEST',
      jotformFormId: 'jf-99',
      source: 'jotform',
    });
    expect(packet.surveys[0].responses[0].submissionId).toBe('jf-sub-1');
    expect(packet.surveys[1]).toMatchObject({
      surveyId: 'survey-blank',
      type: 'INTAKE',
      jotformFormId: null,
      source: 'native',
    });
    expect(packet.surveys[1].responses[0].submissionId).toBeNull();
  });

  it('adds a legacy Jotform survey when the program has a URL and no Survey row', async () => {
    const listFormSubmissions = jest.fn().mockResolvedValue([
      {
        submissionId: '501',
        submittedAt: '2026-08-01T12:00:00.000Z',
        userId: 'user-9',
        answers: { q1: 'yes' },
      },
    ]);
    const { service } = buildService(
      [
        {
          id: 'prog-legacy',
          title: 'Old webinar',
          zoomSessionType: 'WEBINAR',
          startDate: null,
          zoomMeetingId: null,
          chmProgramId: null,
          campaignId,
          jotformIntakeFormUrl: null,
          jotformSurveyUrl:
            'https://communityhealthmedia.jotform.com/260624911991966',
          zoomRecordingSessions: [],
          webinarParticipantEvents: [],
          surveys: [],
        },
      ],
      listFormSubmissions,
    );

    const packet = await service.getCampaignInputPacket(campaignId, requestId);

    expect(listFormSubmissions).toHaveBeenCalledWith('260624911991966');
    expect(packet.surveys).toHaveLength(1);
    expect(packet.surveys[0]).toMatchObject({
      platformToolProgramId: 'prog-legacy',
      surveyId: 'legacy-feedback:260624911991966',
      type: 'FEEDBACK',
      jotformFormId: '260624911991966',
      source: 'jotform',
      responseCount: 1,
    });
  });

  it('does not call Jotform when a Survey row of that type already exists', async () => {
    const listFormSubmissions = jest.fn().mockResolvedValue([]);
    const { service } = buildService(
      [
        {
          id: 'prog-1',
          title: 'Live session',
          zoomSessionType: 'WEBINAR',
          startDate: null,
          zoomMeetingId: null,
          chmProgramId: null,
          campaignId,
          jotformSurveyUrl:
            'https://communityhealthmedia.jotform.com/111111111',
          zoomRecordingSessions: [],
          webinarParticipantEvents: [],
          surveys: [
            {
              id: 'survey-1',
              type: 'FEEDBACK',
              title: 'Feedback',
              jotformFormId: '111111111',
              responses: [],
            },
          ],
        },
      ],
      listFormSubmissions,
    );

    const packet = await service.getCampaignInputPacket(campaignId, requestId);
    expect(listFormSubmissions).not.toHaveBeenCalled();
    expect(packet.surveys).toHaveLength(1);
    expect(packet.surveys[0].surveyId).toBe('survey-1');
  });

  it('keeps the packet when the legacy Jotform call fails', async () => {
    const listFormSubmissions = jest
      .fn()
      .mockRejectedValue(new Error('jotform down'));
    const { service } = buildService(
      [
        {
          id: 'prog-legacy',
          title: 'Old webinar',
          zoomSessionType: 'WEBINAR',
          startDate: null,
          zoomMeetingId: null,
          chmProgramId: null,
          campaignId,
          jotformSurveyUrl:
            'https://communityhealthmedia.jotform.com/222222222',
          zoomRecordingSessions: [],
          webinarParticipantEvents: [],
          surveys: [],
        },
      ],
      listFormSubmissions,
    );

    const packet = await service.getCampaignInputPacket(campaignId, requestId);
    expect(packet.sessions).toHaveLength(1);
    expect(packet.surveys).toEqual([]);
  });
});

describe('rollupAttendance', () => {
  it('falls back to join/leave seconds when duration is null', () => {
    const rows = rollupAttendance({
      platformToolProgramId: 'p1',
      panelistEmails: new Set(),
      profileByUserId: new Map(),
      profileByEmail: new Map(),
      events: [
        {
          participantEmail: 'a@example.com',
          userId: null,
          joinTime: new Date('2026-09-01T15:00:00.000Z'),
          leaveTime: new Date('2026-09-01T15:02:00.000Z'),
          durationSeconds: null,
          source: 'WEBHOOK',
          occurredAt: new Date('2026-09-01T15:00:00.000Z'),
          isHost: false,
        },
      ],
    });
    expect(rows[0].durationSeconds).toBe(120);
  });
});
