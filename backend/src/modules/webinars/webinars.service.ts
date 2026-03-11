import { Injectable, Logger } from '@nestjs/common';
import { ZoomService } from './zoom.service';
import { PrismaService } from '../../prisma/prisma.service';

export interface WebinarItem {
  id: string;
  title: string;
  description: string;
  imageUrl?: string;
  startTime?: string;
  duration?: number;
  joinUrl?: string;
  source: 'zoom' | 'program';
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
  ) {}

  async listWebinars(): Promise<WebinarItem[]> {
    const items: WebinarItem[] = [];

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // 1. Load published DB programs from last 30 days onwards
    const programs = await this.prisma.program.findMany({
      where: {
        status: 'PUBLISHED',
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
      where: { id, status: 'PUBLISHED' },
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
      source: program.zoomMeetingId ? 'zoom' : 'program',
    };
  }
}
