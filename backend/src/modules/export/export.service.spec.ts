import { ExportService } from './export.service';
import type { PrismaService } from '../../prisma/prisma.service';
import type { JotformService } from '../jotform/jotform.service';

describe('ExportService.getCampaignInputPacket', () => {
  const campaignId = 'AZ-25-01_LIV001';
  const requestId = 'req-test-1';

  function buildService(
    programs: unknown[],
    listFormSubmissions: jest.Mock = jest.fn().mockResolvedValue([]),
  ) {
    const findMany = jest.fn().mockResolvedValue(programs);
    const prisma = {
      program: {
        findMany,
      },
    } as unknown as PrismaService;
    const jotform = {
      listFormSubmissions,
    } as unknown as JotformService;
    return {
      service: new ExportService(prisma, jotform),
      findMany,
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

  it('dedupes attendance by participant email and includes surveys', async () => {
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
            participantName: 'Ada',
            userId: 'u1',
            joinTime: new Date('2026-09-01T15:01:00.000Z'),
            leaveTime: null,
            durationSeconds: 60,
            source: 'REPORT_IMPORT',
            occurredAt: new Date('2026-09-01T15:01:00.000Z'),
          },
          {
            participantEmail: 'A@example.com',
            participantName: 'Ada again',
            userId: 'u1',
            joinTime: new Date('2026-09-01T15:05:00.000Z'),
            leaveTime: null,
            durationSeconds: 30,
            source: 'WEBHOOK',
            occurredAt: new Date('2026-09-01T15:05:00.000Z'),
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
    expect(packet.attendance[0].participantEmail).toBe('a@example.com');
    expect(packet.surveys).toHaveLength(1);
    expect(packet.surveys[0]).toMatchObject({
      surveyId: 'survey-1',
      type: 'FEEDBACK',
      jotformFormId: null,
      source: 'native',
      responseCount: 1,
    });
    expect(packet.surveys[0].responses[0]).toMatchObject({
      userId: 'u1',
      submittedAt: submittedAt.toISOString(),
      answers: { q1: 'yes' },
      submissionId: 'native-sub-1',
    });
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
    expect(packet.surveys[0].responses[0]).toMatchObject({
      userId: 'user-9',
      submissionId: '501',
      answers: { q1: 'yes' },
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
          jotformSurveyUrl: 'https://communityhealthmedia.jotform.com/111111111',
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
          jotformSurveyUrl: 'https://communityhealthmedia.jotform.com/222222222',
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
