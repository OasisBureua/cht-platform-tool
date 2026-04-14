import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { AuthUser } from '../../auth/auth.service';
import { ZoomService } from './zoom.service';
import { ZoomMeetingSdkService } from './zoom-meeting-sdk.service';
import { PrismaService } from '../../prisma/prisma.service';

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
  /** Present when sourced from our DB — distinguishes CME webinars vs Zoom Meeting office hours. */
  sessionKind?: 'WEBINAR' | 'MEETING';
  hostDisplayName?: string;
  calendlySchedulingUrl?: string;
  jotformIntakeFormUrl?: string;
  registrationRequiresApproval?: boolean;
}

/**
 * Hybrid listing strategy (transition period):
 *  1. DB PUBLISHED programs are always included — DB is authoritative.
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
    private zoomMeetingSdk: ZoomMeetingSdkService,
  ) {}

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

    // Track which Zoom meeting IDs are already covered by a DB program
    const coveredZoomIds = new Set<string>();

    for (const p of programs) {
      if (p.zoomMeetingId) coveredZoomIds.add(String(p.zoomMeetingId));

      const firstVideo = p.videos[0];
      const imageUrl =
        p.thumbnailUrl ||
        (firstVideo?.platform === 'YOUTUBE'
          ? `https://img.youtube.com/vi/${firstVideo.videoId}/hqdefault.jpg`
          : undefined);

      items.push({
        id: p.id,
        title: p.title,
        description: p.description,
        imageUrl: imageUrl || undefined,
        startTime: p.startDate?.toISOString(),
        duration: p.duration ?? undefined,
        joinUrl: p.zoomJoinUrl || undefined,
        source: 'program',
        sessionKind: 'WEBINAR',
        hostDisplayName: p.hostDisplayName || undefined,
        calendlySchedulingUrl: p.calendlySchedulingUrl || undefined,
        jotformIntakeFormUrl: p.jotformIntakeFormUrl || undefined,
        registrationRequiresApproval: p.registrationRequiresApproval,
      });
    }

    // 2. Add Zoom webinars not yet in the DB (transition fallback)
    if (this.zoom.isConfigured()) {
      try {
        const zoomWebinars = await this.zoom.listWebinars();
        for (const w of zoomWebinars) {
          if (coveredZoomIds.has(String(w.id))) continue; // already covered by DB
          const startTime = w.startTime ? new Date(w.startTime).getTime() : 0;
          if (startTime > 0 && startTime < thirtyDaysAgo.getTime()) continue; // skip if older than 30 days
          items.push({
            id: `zoom-${w.id}`,
            title: w.topic,
            description: w.agenda || w.topic,
            startTime: w.startTime,
            duration: w.duration,
            joinUrl: w.joinUrl,
            source: 'zoom',
          });
        }
      } catch (err) {
        // Non-fatal — DB programs still shown if Zoom API is unavailable
        this.logger.warn(`Zoom listWebinars fallback failed: ${String(err)}`);
      }
    }

    return items;
  }

  /**
   * Published office hours (Zoom Meetings) — interactive drop-in sessions.
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

    const items: WebinarItem[] = [];
    for (const p of programs) {
      const firstVideo = p.videos[0];
      const imageUrl =
        p.thumbnailUrl ||
        (firstVideo?.platform === 'YOUTUBE'
          ? `https://img.youtube.com/vi/${firstVideo.videoId}/hqdefault.jpg`
          : undefined);

      items.push({
        id: p.id,
        title: p.title,
        description: p.description,
        imageUrl: imageUrl || undefined,
        startTime: p.startDate?.toISOString(),
        duration: p.duration ?? undefined,
        joinUrl: p.zoomJoinUrl || undefined,
        source: 'program',
        sessionKind: 'MEETING',
        hostDisplayName: p.hostDisplayName || undefined,
        jotformIntakeFormUrl: p.jotformIntakeFormUrl || undefined,
        registrationRequiresApproval: p.registrationRequiresApproval,
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

    const firstVideo = program.videos[0];
    const imageUrl =
      program.thumbnailUrl ||
      (firstVideo?.platform === 'YOUTUBE'
        ? `https://img.youtube.com/vi/${firstVideo.videoId}/hqdefault.jpg`
        : undefined);

    return {
      id: program.id,
      title: program.title,
      description: program.description,
      imageUrl: imageUrl || undefined,
      startTime: program.startDate?.toISOString(),
      duration: program.duration ?? undefined,
      joinUrl: program.zoomJoinUrl || undefined,
      source: 'program',
      sessionKind: 'WEBINAR',
      hostDisplayName: program.hostDisplayName || undefined,
      calendlySchedulingUrl: program.calendlySchedulingUrl || undefined,
      jotformIntakeFormUrl: program.jotformIntakeFormUrl || undefined,
      registrationRequiresApproval: program.registrationRequiresApproval,
    };
  }

  async getOfficeHoursById(id: string): Promise<WebinarItem | null> {
    const program = await this.prisma.program.findFirst({
      where: { id, status: 'PUBLISHED', zoomSessionType: 'MEETING' },
      include: { videos: { take: 1 } },
    });
    if (!program) return null;

    const firstVideo = program.videos[0];
    const imageUrl =
      program.thumbnailUrl ||
      (firstVideo?.platform === 'YOUTUBE'
        ? `https://img.youtube.com/vi/${firstVideo.videoId}/hqdefault.jpg`
        : undefined);

    return {
      id: program.id,
      title: program.title,
      description: program.description,
      imageUrl: imageUrl || undefined,
      startTime: program.startDate?.toISOString(),
      duration: program.duration ?? undefined,
      joinUrl: program.zoomJoinUrl || undefined,
      source: 'program',
      sessionKind: 'MEETING',
      hostDisplayName: program.hostDisplayName || undefined,
      jotformIntakeFormUrl: program.jotformIntakeFormUrl || undefined,
      registrationRequiresApproval: program.registrationRequiresApproval,
    };
  }

  /**
   * JWT signature + join fields for Zoom Meeting SDK (embedded web client).
   * Requires published office-hours program, Zoom meeting id, and enrollment.
   */
  async getOfficeHoursMeetingSdkAuth(authUser: AuthUser, programId: string): Promise<OfficeHoursMeetingSdkAuthDto> {
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
      throw new ForbiddenException('Register for this session before joining in the app.');
    }

    const program = await this.prisma.program.findFirst({
      where: { id: programId, status: 'PUBLISHED', zoomSessionType: 'MEETING' },
    });
    if (!program?.zoomMeetingId) {
      throw new BadRequestException('This session has no Zoom meeting ID yet.');
    }

    const userName = (authUser.name?.trim() || authUser.email || 'Participant').slice(0, 200);
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
