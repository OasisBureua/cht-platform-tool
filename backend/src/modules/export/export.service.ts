import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export type TranscriptStatus = 'ok' | 'missing';

export interface ExportSessionPacket {
  platformToolProgramId: string;
  campaignId: string;
  kind: string;
  title: string;
  sessionDate: string | null;
  zoomMeetingId: string | null;
  zoomMeetingUuid: string | null;
  transcriptS3Key: string | null;
  transcriptStatus: TranscriptStatus;
  chmProgramId: string | null;
}

export interface ExportAttendanceRow {
  platformToolProgramId: string;
  participantEmail: string | null;
  participantName: string | null;
  userId: string | null;
  joinTime: string | null;
  leaveTime: string | null;
  durationSeconds: number | null;
  source: string;
}

export interface ExportSurveyPacket {
  platformToolProgramId: string;
  surveyId: string;
  type: string;
  title: string;
  responseCount: number;
  responses: Array<{
    userId: string;
    submittedAt: string;
    score: number | null;
    schemaVersion: number;
    answers: unknown;
  }>;
}

export interface CampaignInputPacket {
  campaignId: string;
  generatedAt: string;
  requestId: string;
  sessions: ExportSessionPacket[];
  attendance: ExportAttendanceRow[];
  surveys: ExportSurveyPacket[];
}

const TRANSCRIPT_FILE_TYPES = new Set(['TRANSCRIPT', 'CC']);

@Injectable()
export class ExportService {
  private readonly logger = new Logger(ExportService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Build Hub ingest packet for a campaign.
   * Only Programs with campaignId matching are included (null/unlinked omitted).
   * Transcript fields reflect current Zoom pull state — missing until pull completes.
   */
  async getCampaignInputPacket(
    campaignId: string,
    requestId: string,
  ): Promise<CampaignInputPacket> {
    const id = campaignId.trim();
    const programs = await this.prisma.program.findMany({
      where: { campaignId: id },
      orderBy: [{ startDate: 'asc' }, { createdAt: 'asc' }],
      include: {
        zoomRecordingSessions: {
          orderBy: { startTime: 'asc' },
          include: {
            files: {
              where: {
                fileType: { in: ['TRANSCRIPT', 'CC'] },
              },
            },
          },
        },
        webinarParticipantEvents: {
          where: { event: 'JOINED' },
          orderBy: { occurredAt: 'asc' },
          select: {
            participantEmail: true,
            participantName: true,
            userId: true,
            joinTime: true,
            leaveTime: true,
            durationSeconds: true,
            source: true,
            occurredAt: true,
          },
        },
        surveys: {
          orderBy: { createdAt: 'asc' },
          include: {
            responses: {
              orderBy: { submittedAt: 'asc' },
              select: {
                userId: true,
                submittedAt: true,
                score: true,
                schemaVersion: true,
                answers: true,
              },
            },
          },
        },
      },
    });

    const sessions: ExportSessionPacket[] = [];
    const attendance: ExportAttendanceRow[] = [];
    const surveys: ExportSurveyPacket[] = [];

    for (const program of programs) {
      const recordingSession =
        program.zoomRecordingSessions.find(
          (s) =>
            program.zoomMeetingId && s.zoomMeetingId === program.zoomMeetingId,
        ) ??
        program.zoomRecordingSessions[0] ??
        null;

      const transcript = pickTranscript(recordingSession?.files ?? []);

      sessions.push({
        platformToolProgramId: program.id,
        campaignId: id,
        kind: program.zoomSessionType,
        title: program.title,
        sessionDate: (
          program.startDate ??
          recordingSession?.startTime ??
          null
        )?.toISOString() ?? null,
        zoomMeetingId: program.zoomMeetingId ?? recordingSession?.zoomMeetingId ?? null,
        zoomMeetingUuid: recordingSession?.zoomUuid ?? null,
        transcriptS3Key: transcript.s3Key,
        transcriptStatus: transcript.status,
        chmProgramId: program.chmProgramId ?? null,
      });

      const seenEmails = new Set<string>();
      for (const ev of program.webinarParticipantEvents) {
        const emailKey = (ev.participantEmail || '').trim().toLowerCase();
        if (emailKey) {
          if (seenEmails.has(emailKey)) continue;
          seenEmails.add(emailKey);
        }
        attendance.push({
          platformToolProgramId: program.id,
          participantEmail: ev.participantEmail ?? null,
          participantName: ev.participantName ?? null,
          userId: ev.userId ?? null,
          joinTime: (ev.joinTime ?? ev.occurredAt)?.toISOString() ?? null,
          leaveTime: ev.leaveTime?.toISOString() ?? null,
          durationSeconds: ev.durationSeconds ?? null,
          source: String(ev.source),
        });
      }

      for (const survey of program.surveys) {
        surveys.push({
          platformToolProgramId: program.id,
          surveyId: survey.id,
          type: survey.type,
          title: survey.title,
          responseCount: survey.responses.length,
          responses: survey.responses.map((r) => ({
            userId: r.userId,
            submittedAt: r.submittedAt.toISOString(),
            score: r.score ?? null,
            schemaVersion: r.schemaVersion,
            answers: r.answers,
          })),
        });
      }
    }

    this.logger.log(
      `[export] input-packet campaignId=${id} programs=${programs.length} sessions=${sessions.length} attendance=${attendance.length} surveys=${surveys.length} requestId=${requestId}`,
    );

    return {
      campaignId: id,
      generatedAt: new Date().toISOString(),
      requestId,
      sessions,
      attendance,
      surveys,
    };
  }
}

function pickTranscript(
  files: Array<{
    fileType: string;
    pullStatus: string;
    s3Key: string | null;
  }>,
): { s3Key: string | null; status: TranscriptStatus } {
  const candidates = files.filter((f) =>
    TRANSCRIPT_FILE_TYPES.has(f.fileType.toUpperCase()),
  );
  const prefer = (type: string) =>
    candidates.find(
      (f) =>
        f.fileType.toUpperCase() === type &&
        f.pullStatus === 'COMPLETED' &&
        !!f.s3Key?.trim(),
    );
  const hit = prefer('TRANSCRIPT') ?? prefer('CC');
  if (hit?.s3Key) {
    return { s3Key: hit.s3Key, status: 'ok' };
  }
  return { s3Key: null, status: 'missing' };
}
