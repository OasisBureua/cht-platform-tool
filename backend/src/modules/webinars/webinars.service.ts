import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthUser } from '../../auth/auth.service';
import { ZoomService } from './zoom.service';
import { ZoomMeetingSdkService } from './zoom-meeting-sdk.service';
import { PrismaService } from '../../prisma/prisma.service';
import { programCoverImageUrl } from '../../utils/session-hero-url';
import { resolveLiveJoinWindow } from '../../utils/session-join-window';
import { learnerWebinarJoinUrl } from '../../utils/webinar-join-url';
import { SurveyType } from '@prisma/client';

export interface OfficeHoursMeetingSdkAuthDto {
  signature: string;
  sdkKey: string;
  meetingNumber: string;
  password: string;
  userName: string;
  userEmail: string;
}

export interface WebinarItem {
  id: string;
  title: string;
  description: string;
  imageUrl?: string;
  startTime?: string;
  duration?: number;
  joinUrl?: string;
  source: 'zoom' | 'program';
  /** Present when sourced from our DB - distinguishes CME webinars vs Zoom Meeting office hours. */
  sessionKind?: 'WEBINAR' | 'MEETING';
  hostDisplayName?: string;
  hostBio?: string;
  speakers?: string[];
  /** @deprecated Intake is native-only; kept optional for older clients. */
  jotformIntakeFormUrl?: string;
  /** Native INTAKE survey id when configured on the program. */
  intakeSurveyId?: string;
  hasIntakeSurvey?: boolean;
  registrationRequiresApproval?: boolean;
  /** Honorarium in whole dollars when configured on the program (stored as cents in DB). */
  honorariumAmount?: number;
}

/**
 * Hybrid listing strategy (transition period):
 *  1. DB PUBLISHED programs are always included - DB is authoritative.
 *     Deleting a program from admin removes it from this list immediately.
 *  2. Zoom webinars from the account are also included, BUT only if no DB
 *     program already references that Zoom meeting ID (deduplication).
 *     This surfaces pre-existing Zoom webinars that haven't been imported
 *     into the DB yet.
 * Once all webinars are managed via the admin scheduler, Zoom fallback can
 * be removed and the DB becomes the sole source of truth.
 */
@Injectable()
export class WebinarsService {
  private readonly logger = new Logger(WebinarsService.name);

  constructor(
    private zoom: ZoomService,
    private prisma: PrismaService,
    private config: ConfigService,
    private zoomMeetingSdk: ZoomMeetingSdkService,
  ) {}

  private sessionAssetsPublicBase(): string {
    return this.config.get<string>('sessionAssets.publicUrlBase')?.trim() || '';
  }

  private programImageUrl(program: {
    sessionHeroImageUrl?: string | null;
    thumbnailUrl?: string | null;
    videos?: Array<{ platform: string; videoId: string }>;
  }): string | undefined {
    const firstVideo = program.videos?.[0];
    const youtubeFallback =
      firstVideo?.platform === 'YOUTUBE'
        ? `https://img.youtube.com/vi/${firstVideo.videoId}/hqdefault.jpg`
        : undefined;
    return programCoverImageUrl(
      program,
      this.sessionAssetsPublicBase(),
      youtubeFallback,
    );
  }

  /** Attendee join URL only inside the live session window. */
  private gatedLearnerJoinUrl(
    zoomJoinUrl: string | null | undefined,
    startDate: Date | string | null | undefined,
    duration: number | null | undefined,
  ): string | undefined {
    const window = resolveLiveJoinWindow(startDate, duration);
    const url = learnerWebinarJoinUrl(zoomJoinUrl);
    return window.canJoin && url ? url : undefined;
  }

  /** Latest native INTAKE survey id per program (registration uses native surveys only). */
  private async intakeSurveyIdsByProgramId(
    programIds: string[],
  ): Promise<Map<string, string>> {
    const map = new Map<string, string>();
    if (programIds.length === 0) return map;
    const rows = await this.prisma.survey.findMany({
      where: { programId: { in: programIds }, type: SurveyType.INTAKE },
      orderBy: { createdAt: 'desc' },
      select: { id: true, programId: true },
    });
    for (const row of rows) {
      if (!map.has(row.programId)) map.set(row.programId, row.id);
    }
    return map;
  }

  async listWebinars(): Promise<WebinarItem[]> {
    const items: WebinarItem[] = [];

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // 1. Load published DB programs from last 30 days onwards
    const programs = await this.prisma.program.findMany({
      where: {
        status: 'PUBLISHED',
        zoomSessionType: 'WEBINAR',
        startDate: { gte: thirtyDaysAgo },
      },
      include: { videos: { take: 1 } },
      orderBy: { startDate: 'desc' },
      take: 50,
    });

    const intakeByProgramId = await this.intakeSurveyIdsByProgramId(
      programs.map((p) => p.id),
    );

    // Track which Zoom meeting IDs are already covered by a DB program
    const coveredZoomIds = new Set<string>();

    for (const p of programs) {
      if (p.zoomMeetingId) coveredZoomIds.add(String(p.zoomMeetingId));

      const imageUrl = this.programImageUrl(p);
      const intakeSurveyId = intakeByProgramId.get(p.id);
      items.push({
        id: p.id,
        title: p.title,
        description: p.description,
        imageUrl: imageUrl || undefined,
        startTime: p.startDate?.toISOString(),
        duration: p.duration ?? undefined,
        joinUrl: this.gatedLearnerJoinUrl(p.zoomJoinUrl, p.startDate, p.duration),
        source: 'program',
        sessionKind: 'WEBINAR',
        hostDisplayName: p.hostDisplayName || undefined,
        hostBio: p.hostBio || undefined,
        speakers: p.speakers?.length ? p.speakers : undefined,
        intakeSurveyId,
        hasIntakeSurvey: !!intakeSurveyId,
        registrationRequiresApproval: p.registrationRequiresApproval,
        honorariumAmount: p.honorariumAmount
          ? p.honorariumAmount / 100
          : undefined,
      });
    }

    // 2. Merge upcoming Zoom webinars not yet linked to a DB program (when Zoom is configured).
    if (this.zoom.isConfigured()) {
      try {
        const zoomWebinars = await this.zoom.listWebinars();
        const nowMs = Date.now();
        for (const w of zoomWebinars) {
          if (coveredZoomIds.has(String(w.id))) continue;
          const startTime = w.startTime ? new Date(w.startTime).getTime() : 0;
          if (startTime > 0 && startTime < nowMs) continue;
          if (startTime > 0 && startTime < thirtyDaysAgo.getTime()) continue;
          items.push({
            id: `zoom-${w.id}`,
            title: w.topic,
            description: w.agenda || w.topic,
            startTime: w.startTime,
            duration: w.duration,
            joinUrl: w.joinUrl,
            source: 'zoom',
            sessionKind: 'WEBINAR',
          });
        }
      } catch (err) {
        this.logger.warn(`Zoom listWebinars merge failed: ${String(err)}`);
      }
    }

    items.sort((a, b) => {
      const ta = a.startTime ? new Date(a.startTime).getTime() : 0;
      const tb = b.startTime ? new Date(b.startTime).getTime() : 0;
      if (ta !== tb) return ta - tb;
      return a.title.localeCompare(b.title);
    });

    return items;
  }

  /**
   * Published office hours (Zoom Meetings) - interactive drop-in sessions.
   */
  async listOfficeHours(): Promise<WebinarItem[]> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const programs = await this.prisma.program.findMany({
      where: {
        status: 'PUBLISHED',
        zoomSessionType: 'MEETING',
        startDate: { gte: thirtyDaysAgo },
      },
      include: { videos: { take: 1 } },
      orderBy: { startDate: 'desc' },
      take: 50,
    });

    const intakeByProgramId = await this.intakeSurveyIdsByProgramId(
      programs.map((p) => p.id),
    );

    const items: WebinarItem[] = [];
    for (const p of programs) {
      const imageUrl = this.programImageUrl(p);
      const intakeSurveyId = intakeByProgramId.get(p.id);

      items.push({
        id: p.id,
        title: p.title,
        description: p.description,
        imageUrl: imageUrl || undefined,
        startTime: p.startDate?.toISOString(),
        duration: p.duration ?? undefined,
        joinUrl: this.gatedLearnerJoinUrl(p.zoomJoinUrl, p.startDate, p.duration),
        source: 'program',
        sessionKind: 'MEETING',
        hostDisplayName: p.hostDisplayName || undefined,
        hostBio: p.hostBio || undefined,
        speakers: p.speakers?.length ? p.speakers : undefined,
        intakeSurveyId,
        hasIntakeSurvey: !!intakeSurveyId,
        registrationRequiresApproval: p.registrationRequiresApproval,
        honorariumAmount: p.honorariumAmount
          ? p.honorariumAmount / 100
          : undefined,
      });
    }
    return items;
  }

  async getWebinarById(id: string): Promise<WebinarItem | null> {
    // Zoom-only IDs (not yet in DB)
    if (id.startsWith('zoom-')) {
      const zoomId = id.replace(/^zoom-/, '');
      const w = await this.zoom.getWebinarById(zoomId);
      if (!w) return null;
      return {
        id: `zoom-${w.id}`,
        title: w.topic,
        description: w.agenda || w.topic,
        startTime: w.startTime,
        duration: w.duration,
        joinUrl: w.joinUrl,
        source: 'zoom',
      };
    }

    const program = await this.prisma.program.findFirst({
      where: { id, status: 'PUBLISHED', zoomSessionType: 'WEBINAR' },
      include: { videos: { take: 1 } },
    });
    if (!program) return null;

    const imageUrl = this.programImageUrl(program);
    const intakeByProgramId = await this.intakeSurveyIdsByProgramId([program.id]);
    const intakeSurveyId = intakeByProgramId.get(program.id);

    return {
      id: program.id,
      title: program.title,
      description: program.description,
      imageUrl: imageUrl || undefined,
      startTime: program.startDate?.toISOString(),
      duration: program.duration ?? undefined,
      joinUrl: this.gatedLearnerJoinUrl(
        program.zoomJoinUrl,
        program.startDate,
        program.duration,
      ),
      source: 'program',
      sessionKind: 'WEBINAR',
      hostDisplayName: program.hostDisplayName || undefined,
      hostBio: program.hostBio || undefined,
      speakers: program.speakers?.length ? program.speakers : undefined,
      intakeSurveyId,
      hasIntakeSurvey: !!intakeSurveyId,
      registrationRequiresApproval: program.registrationRequiresApproval,
      honorariumAmount: program.honorariumAmount
        ? program.honorariumAmount / 100
        : undefined,
    };
  }

  async getOfficeHoursById(id: string): Promise<WebinarItem | null> {
    const program = await this.prisma.program.findFirst({
      where: { id, status: 'PUBLISHED', zoomSessionType: 'MEETING' },
      include: { videos: { take: 1 } },
    });
    if (!program) return null;

    const imageUrl = this.programImageUrl(program);
    const intakeByProgramId = await this.intakeSurveyIdsByProgramId([program.id]);
    const intakeSurveyId = intakeByProgramId.get(program.id);

    return {
      id: program.id,
      title: program.title,
      description: program.description,
      imageUrl: imageUrl || undefined,
      startTime: program.startDate?.toISOString(),
      duration: program.duration ?? undefined,
      joinUrl: this.gatedLearnerJoinUrl(
        program.zoomJoinUrl,
        program.startDate,
        program.duration,
      ),
      source: 'program',
      sessionKind: 'MEETING',
      hostDisplayName: program.hostDisplayName || undefined,
      hostBio: program.hostBio || undefined,
      speakers: program.speakers?.length ? program.speakers : undefined,
      intakeSurveyId,
      hasIntakeSurvey: !!intakeSurveyId,
      registrationRequiresApproval: program.registrationRequiresApproval,
      honorariumAmount: program.honorariumAmount
        ? program.honorariumAmount / 100
        : undefined,
    };
  }

  /**
   * JWT signature + join fields for Zoom Meeting SDK (embedded web client).
   * Requires published office-hours program, Zoom meeting id, and enrollment.
   */
  async getOfficeHoursMeetingSdkAuth(
    authUser: AuthUser,
    programId: string,
  ): Promise<OfficeHoursMeetingSdkAuthDto> {
    if (!this.zoomMeetingSdk.isConfigured()) {
      throw new ServiceUnavailableException(
        'In-browser Zoom is not configured. Set ZOOM_SDK_KEY and ZOOM_SDK_SECRET from a Zoom Meeting SDK app.',
      );
    }

    const userId = authUser.userId;

    const enrollment = await this.prisma.programEnrollment.findUnique({
      where: { userId_programId: { userId, programId } },
    });
    if (!enrollment) {
      throw new ForbiddenException(
        'Register for this session before joining in the app.',
      );
    }

    const program = await this.prisma.program.findFirst({
      where: { id: programId, status: 'PUBLISHED', zoomSessionType: 'MEETING' },
    });
    if (!program?.zoomMeetingId) {
      throw new BadRequestException('This session has no Zoom meeting ID yet.');
    }

    const userName = (
      authUser.name?.trim() ||
      authUser.email ||
      'Participant'
    ).slice(0, 200);
    const userEmail = (authUser.email || '').trim();

    const meetingNumber = String(program.zoomMeetingId).replace(/\s/g, '');
    const password = program.zoomMeetingPassword?.trim() ?? '';
    const signature = this.zoomMeetingSdk.generateSignature(meetingNumber, 0);

    return {
      signature,
      sdkKey: this.zoomMeetingSdk.getSdkKey(),
      meetingNumber,
      password,
      userName,
      userEmail,
    };
  }
}
