import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateVideoDto } from './dto/create-video.dto';
import { UpdateVideoDto } from './dto/update-video.dto';
import { TrackVideoViewDto } from './dto/track-video-view.dto';

@Injectable()
export class VideosService {
    constructor(private prisma: PrismaService) {}

    async create(createVideoDto: CreateVideoDto) {
    const data = this.removeUndefined(createVideoDto);
    return this.prisma.video.create({
      data,
      include: {
        program: {
          select: {
            id: true,
            title: true,
          },
        },
      },
    });
  }

  async findAll(programId?: string) {
    const where = programId ? { programId } : {};

    return this.prisma.video.findMany({
        where,
        include: {
            program: {
                select: {
                    id: true,
                    title: true,
                },
            },
            _count: {
                select: {
                    views: true,
                },
            },
        },
        orderBy: { order: 'asc' }
    });
  }

  async findOne(id: string){
    const video = await this.prisma.video.findUnique({
        where: { id },
        include: {
            program: true,
            _count: {
                select: {
                    views: true,
                },
            },
        },
    });

    if (!video) {
        throw new NotFoundException(`Video with ID ${id} not found`);
    }

    return video;
  }

  async update(id: string, updateVideoDto: UpdateVideoDto) {
    try {
        const data = this.removeUndefined(updateVideoDto);
        return await this.prisma.video.update({
            where: { id },
            data,
        });
    } catch (error) {
        throw new NotFoundException(`Video with ID ${id} not found`);
    }
  }

  async remove(id: string) {
    try {
        return await this.prisma.video.delete({
            where: { id },
        });
    } catch (error) {
        throw new NotFoundException(`Video with ID ${id} not found`);
    }
  }

  async trackView(videoId: string, userId: string, trackViewDto: TrackVideoViewDto) {
    const { watchedSeconds, completed } = trackViewDto;

    // Get video to calculate progress
    const video = await this.prisma.video.findUnique({
      where: { id: videoId },
    });

    if (!video) {
      throw new NotFoundException(`Video with ID ${videoId} not found`);
    }

    // Calculate progress percentage
    const progress = video.duration > 0 ? (watchedSeconds / video.duration) * 100 : 0;

    // Upsert video view (create or update)
    return this.prisma.videoView.upsert({
      where: {
        userId_videoId: {
          userId,
          videoId,
        },
      },
      create: {
        userId,
        videoId,
        watchedSeconds,
        progress,
        completed,
      },
      update: {
        watchedSeconds,
        progress,
        completed,
        updatedAt: new Date(),
      },
    });
  }

  async getUserProgress(userId: string, videoId: string) {
    return this.prisma.videoView.findUnique({
      where: {
        userId_videoId: {
          userId,
          videoId,
        },
      },
      include: {
        video: {
          select: {
            id: true,
            title: true,
            duration: true,
          },
        },
      },
    });
  }

  async getUserVideoHistory(userId: string) {
    return this.prisma.videoView.findMany({
      where: { userId },
      include: {
        video: {
          include: {
            program: {
              select: {
                id: true,
                title: true,
              },
            },
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  private removeUndefined(obj: any): any {
    return Object.fromEntries(
      Object.entries(obj).filter(([_, value]) => value !== undefined)
    );
  }
}