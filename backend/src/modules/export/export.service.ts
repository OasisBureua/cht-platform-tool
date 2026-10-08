import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { JotformService } from '../jotform/jotform.service';
import { extractJotformFormIdFromUrl } from '../../utils/jotform-form-id';

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

/** CPR-42 — rolled attendance (summed watch time, no names). */
export interface ExportAttendanceRow {
  platformToolProgramId: string;
  participantEmail: string | null;
  userId: string | null;
  joinTime: string | null;
  leaveTime: string | null;
  durationSeconds: number | null;
  source: string;
  specialty: string | null;
  institution: string | null;
  /** Stable Hub upsert key for the rolled row. */
  platformEventId: string;
}

/** CPR-42 — program registrations (no names). */
export interface ExportRegistrationRow {
  platformToolProgramId: string;
  userId: string;
  registeredAt: string;
  status: string;
  specialty: string | null;
  institution: string | null;
}

export interface ExportSurveyPacket {
  platformToolProgramId: string;
  surveyId: string;
  type: string;
  title: string;
  jotformFormId: string | null;
  source: 'native' | 'jotform';
  responseCount: number;
  responses: Array<{
    userId: string;
    submittedAt: string;
    score: number | null;
    schemaVersion: number;
    answers: unknown;
    submissionId: string | null;
  }>;
}

export interface CampaignInputPacket {
  campaignId: string;
  generatedAt: string;
  requestId: string;
  sessions: ExportSessionPacket[];
  attendance: ExportAttendanceRow[];
  registrations: ExportRegistrationRow[];
  surveys: ExportSurveyPacket[];
}

const TRANSCRIPT_FILE_TYPES = new Set(['TRANSCRIPT', 'CC']);

type Profile = { specialty: string | null; institution: string | null };

type JoinedEvent = {
  participantEmail: string | null;
  userId: string | null;
  joinTime: Date | null;
  leaveTime: Date | null;
  durationSeconds: number | null;
  source: string;
  occurredAt: Date;
  isHost: boolean;
};

@Injectable()
export class ExportService {
  private readonly logger = new Logger(ExportService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jotform: JotformService,
  ) {}

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
            userId: true,
            joinTime: true,
            leaveTime: true,
            durationSeconds: true,
            source: true,
            occurredAt: true,
            isHost: true,
          },
        },
        programRegistrations: {
          where: { status: { not: 'REJECTED' } },
          orderBy: { createdAt: 'asc' },
          select: {
            userId: true,
            status: true,
            createdAt: true,
            user: {
              select: {
                id: true,
                email: true,
                specialty: true,
                institution: true,
              },
            },
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
                submissionId: true,
              },
            },
          },
        },
      },
    });

    const sessions: ExportSessionPacket[] = [];
    const attendance: ExportAttendanceRow[] = [];
    const registrations: ExportRegistrationRow[] = [];
    const surveys: ExportSurveyPacket[] = [];

    const profileByUserId = new Map<string, Profile>();
    const profileByEmail = new Map<string, Profile>();
    for (const program of programs) {
      for (const reg of program.programRegistrations) {
        const profile: Profile = {
          specialty: reg.user.specialty?.trim() || null,
          institution: reg.user.institution?.trim() || null,
        };
        profileByUserId.set(reg.userId, profile);
        const email = (reg.user.email || '').trim().toLowerCase();
        if (email) profileByEmail.set(email, profile);
      }
    }

    const missingUserIds = new Set<string>();
    for (const program of programs) {
      for (const ev of program.webinarParticipantEvents) {
        if (ev.userId && !profileByUserId.has(ev.userId)) {
          missingUserIds.add(ev.userId);
        }
      }
    }
    if (missingUserIds.size > 0) {
      const users = await this.prisma.user.findMany({
        where: { id: { in: [...missingUserIds] } },
        select: { id: true, email: true, specialty: true, institution: true },
      });
      for (const user of users) {
        const profile: Profile = {
          specialty: user.specialty?.trim() || null,
          institution: user.institution?.trim() || null,
        };
        profileByUserId.set(user.id, profile);
        const email = (user.email || '').trim().toLowerCase();
        if (email) profileByEmail.set(email, profile);
      }
    }

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
        sessionDate:
          (
            program.startDate ??
            recordingSession?.startTime ??
            null
          )?.toISOString() ?? null,
        zoomMeetingId:
          program.zoomMeetingId ?? recordingSession?.zoomMeetingId ?? null,
        zoomMeetingUuid: recordingSession?.zoomUuid ?? null,
        transcriptS3Key: transcript.s3Key,
        transcriptStatus: transcript.status,
        chmProgramId: program.chmProgramId ?? null,
      });

      for (const reg of program.programRegistrations) {
        registrations.push({
          platformToolProgramId: program.id,
          userId: reg.userId,
          registeredAt: reg.createdAt.toISOString(),
          status: String(reg.status),
          specialty: reg.user.specialty?.trim() || null,
          institution: reg.user.institution?.trim() || null,
        });
      }

      attendance.push(
        ...rollupAttendance({
          platformToolProgramId: program.id,
          events: program.webinarParticipantEvents,
          panelistEmails: panelistEmailSet(program.zoomPanelistLinks),
          profileByUserId,
          profileByEmail,
        }),
      );

      for (const survey of program.surveys) {
        const jotformFormId = survey.jotformFormId?.trim() || null;
        surveys.push({
          platformToolProgramId: program.id,
          surveyId: survey.id,
          type: survey.type,
          title: survey.title,
          jotformFormId,
          source: jotformFormId ? 'jotform' : 'native',
          responseCount: survey.responses.length,
          responses: survey.responses.map((r) => ({
            userId: r.userId,
            submittedAt: r.submittedAt.toISOString(),
            score: r.score ?? null,
            schemaVersion: r.schemaVersion,
            answers: r.answers,
            submissionId: r.submissionId?.trim() || null,
          })),
        });
      }

      await this.appendLegacyJotformSurveys(program, surveys);
    }

    this.logger.log(
      `[export] input-packet campaignId=${id} programs=${programs.length} sessions=${sessions.length} attendance=${attendance.length} registrations=${registrations.length} surveys=${surveys.length} requestId=${requestId}`,
    );

    return {
      campaignId: id,
      generatedAt: new Date().toISOString(),
      requestId,
      sessions,
      attendance,
      registrations,
      surveys,
    };
  }

  /**
   * CPR-5: a program can still have only a Jotform URL and no Survey row.
   * Those answers are not in the database, so the packet reads them from
   * Jotform. A Survey row of the same type wins and is not fetched again.
   * A Jotform failure skips that form and leaves the rest of the packet.
   */
  private async appendLegacyJotformSurveys(
    program: {
      id: string;
      jotformIntakeFormUrl?: string | null;
      jotformSurveyUrl?: string | null;
      surveys: Array<{ type: string }>;
    },
    surveys: ExportSurveyPacket[],
  ): Promise<void> {
    const types = new Set(program.surveys.map((survey) => survey.type));
    const slots: Array<{ type: 'INTAKE' | 'FEEDBACK'; url: string | null }> =
      [];
    if (!types.has('INTAKE')) {
      slots.push({
        type: 'INTAKE',
        url: program.jotformIntakeFormUrl?.trim() || null,
      });
    }
    if (!types.has('FEEDBACK')) {
      slots.push({
        type: 'FEEDBACK',
        url: program.jotformSurveyUrl?.trim() || null,
      });
    }

    for (const slot of slots) {
      if (!slot.url) continue;
      const formId = extractJotformFormIdFromUrl(slot.url);
      if (!formId) continue;
      let submissions: Awaited<
        ReturnType<JotformService['listFormSubmissions']>
      >;
      try {
        submissions = await this.jotform.listFormSubmissions(formId);
      } catch (err) {
        this.logger.warn(
          `[export] legacy jotform skipped programId=${program.id} type=${slot.type} formId=${formId} error=${err instanceof Error ? err.message : String(err)}`,
        );
        continue;
      }
      surveys.push({
        platformToolProgramId: program.id,
        surveyId: `legacy-${slot.type.toLowerCase()}:${formId}`,
        type: slot.type,
        title:
          slot.type === 'INTAKE'
            ? 'Legacy Jotform intake'
            : 'Legacy Jotform post-event',
        jotformFormId: formId,
        source: 'jotform',
        responseCount: submissions.length,
        responses: submissions.map((row) => ({
          userId: row.userId ?? '',
          submittedAt: row.submittedAt,
          score: null,
          schemaVersion: 1,
          answers: row.answers,
          submissionId: row.submissionId,
        })),
      });
    }
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

function panelistEmailSet(raw: unknown): Set<string> {
  const out = new Set<string>();
  if (!Array.isArray(raw)) return out;
  for (const row of raw) {
    if (!row || typeof row !== 'object') continue;
    const email = String(
      (row as { email?: unknown }).email ?? '',
    )
      .trim()
      .toLowerCase();
    if (email) out.add(email);
  }
  return out;
}

function segmentSeconds(ev: JoinedEvent): number {
  if (ev.durationSeconds != null && Number.isFinite(ev.durationSeconds)) {
    return Math.max(0, Math.floor(ev.durationSeconds));
  }
  const join = ev.joinTime ?? ev.occurredAt;
  const leave = ev.leaveTime;
  if (join && leave) {
    const ms = leave.getTime() - join.getTime();
    if (Number.isFinite(ms) && ms > 0) return Math.floor(ms / 1000);
  }
  return 0;
}

function attendeeKey(ev: JoinedEvent): string | null {
  const email = (ev.participantEmail || '').trim().toLowerCase();
  if (email) return `e:${email}`;
  const userId = (ev.userId || '').trim();
  if (userId) return `u:${userId}`;
  return null;
}

/** CPR-42 — sum rejoin segments; prefer REPORT_IMPORT; drop hosts/panelists. */
export function rollupAttendance(opts: {
  platformToolProgramId: string;
  events: JoinedEvent[];
  panelistEmails: Set<string>;
  profileByUserId: Map<string, Profile>;
  profileByEmail: Map<string, Profile>;
}): ExportAttendanceRow[] {
  const hasReportImport = opts.events.some(
    (ev) => String(ev.source) === 'REPORT_IMPORT',
  );
  const pool = hasReportImport
    ? opts.events.filter((ev) => String(ev.source) === 'REPORT_IMPORT')
    : opts.events;

  type Acc = {
    email: string | null;
    userId: string | null;
    seconds: number;
    joinTime: Date | null;
    leaveTime: Date | null;
    source: string;
  };
  const byKey = new Map<string, Acc>();

  for (const ev of pool) {
    if (ev.isHost) continue;
    const email = (ev.participantEmail || '').trim().toLowerCase() || null;
    if (email && opts.panelistEmails.has(email)) continue;
    const key = attendeeKey(ev);
    if (!key) continue;

    const seconds = segmentSeconds(ev);
    const prev = byKey.get(key);
    if (!prev) {
      byKey.set(key, {
        email,
        userId: ev.userId?.trim() || null,
        seconds,
        joinTime: ev.joinTime ?? ev.occurredAt,
        leaveTime: ev.leaveTime,
        source: String(ev.source),
      });
      continue;
    }
    prev.seconds += seconds;
    if (!prev.userId && ev.userId?.trim()) prev.userId = ev.userId.trim();
    const join = ev.joinTime ?? ev.occurredAt;
    if (join && (!prev.joinTime || join < prev.joinTime)) prev.joinTime = join;
    if (
      ev.leaveTime &&
      (!prev.leaveTime || ev.leaveTime > prev.leaveTime)
    ) {
      prev.leaveTime = ev.leaveTime;
    }
    if (String(ev.source) === 'REPORT_IMPORT') prev.source = 'REPORT_IMPORT';
  }

  const rows: ExportAttendanceRow[] = [];
  for (const [key, acc] of byKey.entries()) {
    const profile =
      (acc.userId ? opts.profileByUserId.get(acc.userId) : undefined) ??
      (acc.email ? opts.profileByEmail.get(acc.email) : undefined);
    rows.push({
      platformToolProgramId: opts.platformToolProgramId,
      participantEmail: acc.email,
      userId: acc.userId,
      joinTime: acc.joinTime?.toISOString() ?? null,
      leaveTime: acc.leaveTime?.toISOString() ?? null,
      durationSeconds: acc.seconds > 0 ? acc.seconds : null,
      source: acc.source,
      specialty: profile?.specialty ?? null,
      institution: profile?.institution ?? null,
      platformEventId: `rollup:${opts.platformToolProgramId}:${key}`,
    });
  }
  return rows;
}
