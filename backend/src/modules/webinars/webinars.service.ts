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

@Injectable()
export class WebinarsService {
  private readonly logger = new Logger(WebinarsService.name);

  constructor(
    private zoom: ZoomService,
    private prisma: PrismaService,
  ) {}

  async listWebinars(): Promise<WebinarItem[]> {
    const items: WebinarItem[] = [];

    if (this.zoom.isConfigured()) {
      const zoomWebinars = await this.zoom.listWebinars();
      for (const w of zoomWebinars) {
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
    }

    const programs = await this.prisma.program.findMany({
      where: { status: 'PUBLISHED' },
      include: { videos: { take: 1 } },
      orderBy: { startDate: 'desc' },
      take: 50,
    });

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
        duration: undefined,
        joinUrl: p.zoomJoinUrl || undefined,
        source: 'program',
      });
    }

    return items;
  }

  async getWebinarById(id: string): Promise<WebinarItem | null> {
    if (id.startsWith('zoom-')) {
      const zoomId = id.replace(/^zoom-/, '');
      const webinars = await this.zoom.listWebinars();
      const w = webinars.find((x) => x.id === zoomId);
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
      joinUrl: program.zoomJoinUrl || undefined,
      source: 'program',
    };
  }
}
