import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { QueueService } from '../../queue/queue.service';
import { EnrollUserDto, EnrollmentResponseDto } from './dto/enroll-user.dto';
import { ProgramResponseDto, VideoDto } from './dto/program-response.dto';
import { UpdateVideoProgressDto, VideoProgressResponseDto } from './dto/update-video-progress.dto';

@Injectable()
export class ProgramsService {
  private readonly logger = new Logger(ProgramsService.name);

  constructor(
    private prisma: PrismaService,
    private queueService: QueueService,
  ) {}

  /**
   * Get all published programs
   */
  async getAllPrograms(): Promise<ProgramResponseDto[]> {
    const programs = await this.prisma.program.findMany({
      where: { status: 'PUBLISHED' },
      include: {
        videos: {
          orderBy: { order: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return programs.map((p) => ({
      id: p.id,
      title: p.title,
      description: p.description,
      thumbnailUrl: p.thumbnailUrl || undefined,
      creditAmount: p.creditAmount,
      accreditationBody: p.accreditationBody || undefined,
      status: p.status,
      sponsorName: p.sponsorName,
      sponsorLogo: p.sponsorLogo || undefined,
      honorariumAmount: p.honorariumAmount ? p.honorariumAmount / 100 : undefined,
      videos: p.videos.map((v) => ({
        id: v.id,
        title: v.title,
        description: v.description || undefined,
        platform: v.platform,
        videoId: v.videoId,
        embedUrl: v.embedUrl,
        duration: v.duration,
        order: v.order,
      })),
    }));
  }

  /**
   * Get single program by ID
   */
  async getProgramById(programId: string): Promise<ProgramResponseDto> {
    const program = await this.prisma.program.findUnique({
      where: { id: programId },
      include: {
        videos: {
          orderBy: { order: 'asc' },
        },
      },
    });

    if (!program) {
      throw new NotFoundException('Program not found');
    }

    return {
      id: program.id,
      title: program.title,
      description: program.description,
      thumbnailUrl: program.thumbnailUrl || undefined,
      creditAmount: program.creditAmount,
      accreditationBody: program.accreditationBody || undefined,
      status: program.status,
      sponsorName: program.sponsorName,
      sponsorLogo: program.sponsorLogo || undefined,
      honorariumAmount: program.honorariumAmount ? program.honorariumAmount / 100 : undefined,
      videos: program.videos.map((v) => ({
        id: v.id,
        title: v.title,
        description: v.description || undefined,
        platform: v.platform,
        videoId: v.videoId,
        embedUrl: v.embedUrl,
        duration: v.duration,
        order: v.order,
      })),
    };
  }

  /**
   * Enroll user in program
   */
  async enrollUser(dto: EnrollUserDto): Promise<EnrollmentResponseDto> {
    this.logger.log(`Enrolling user ${dto.userId} in program ${dto.programId}`);

    // Check if already enrolled
    const existing = await this.prisma.programEnrollment.findUnique({
      where: {
        userId_programId: {
          userId: dto.userId,
          programId: dto.programId,
        },
      },
    });

    if (existing) {
      throw new BadRequestException('User already enrolled in this program');
    }

    // Get user and program
    const [user, program] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: dto.userId } }),
      this.prisma.program.findUnique({ where: { id: dto.programId } }),
    ]);

    if (!user) throw new NotFoundException('User not found');
    if (!program) throw new NotFoundException('Program not found');

    // Create enrollment
    const enrollment = await this.prisma.programEnrollment.create({
      data: {
        userId: dto.userId,
        programId: dto.programId,
        enrolledAt: new Date(),
        overallProgress: 0,
        completed: false,
      },
    });

    // Send welcome email
    await this.queueService.sendEmail(
      user.email,
      `Welcome to ${program.title}`,
      `You have successfully enrolled in ${program.title}. Start learning now to earn ${program.creditAmount} CME credits!`,
    );

    this.logger.log(`User enrolled successfully: ${enrollment.id}`);

    return {
      id: enrollment.id,
      userId: enrollment.userId,
      programId: enrollment.programId,
      overallProgress: enrollment.overallProgress,
      completed: enrollment.completed,
      enrolledAt: enrollment.enrolledAt.toISOString(),
    };
  }

  /**
   * Get user's enrollments
   */
  async getUserEnrollments(userId: string) {
    const enrollments = await this.prisma.programEnrollment.findMany({
      where: { userId },
      include: {
        program: {
          include: {
            videos: true,
          },
        },
      },
      orderBy: { enrolledAt: 'desc' },
    });

    return enrollments.map((e) => ({
      id: e.id,
      userId: e.userId,
      programId: e.programId,
      overallProgress: e.overallProgress,
      completed: e.completed,
      enrolledAt: e.enrolledAt.toISOString(),
      completedAt: e.completedAt?.toISOString(),
      program: {
        id: e.program.id,
        title: e.program.title,
        description: e.program.description,
        thumbnailUrl: e.program.thumbnailUrl || undefined,
        creditAmount: e.program.creditAmount,
        honorariumAmount: e.program.honorariumAmount ? e.program.honorariumAmount / 100 : undefined,
        videosCount: e.program.videos.length,
      },
    }));
  }

  /**
   * Update video progress
   */
  async updateVideoProgress(dto: UpdateVideoProgressDto): Promise<VideoProgressResponseDto> {
    this.logger.debug(`Updating video progress: ${dto.videoId} for user ${dto.userId}`);

    // Get or create video view
    const videoView = await this.prisma.videoView.upsert({
      where: {
        userId_videoId: {
          userId: dto.userId,
          videoId: dto.videoId,
        },
      },
      update: {
        watchedSeconds: dto.watchedSeconds,
        progress: dto.progress,
        completed: dto.completed,
        completedAt: dto.completed ? new Date() : null,
      },
      create: {
        userId: dto.userId,
        videoId: dto.videoId,
        watchedSeconds: dto.watchedSeconds,
        progress: dto.progress,
        completed: dto.completed,
        completedAt: dto.completed ? new Date() : null,
      },
      include: {
        video: {
          include: {
            program: true,
          },
        },
      },
    });

    // Update program enrollment progress
    await this.updateProgramProgress(dto.userId, videoView.video.programId);

    return {
      id: videoView.id,
      userId: videoView.userId,
      videoId: videoView.videoId,
      watchedSeconds: videoView.watchedSeconds,
      progress: videoView.progress,
      completed: videoView.completed,
      completedAt: videoView.completedAt?.toISOString(),
    };
  }

  /**
   * Update overall program progress
   */
  private async updateProgramProgress(userId: string, programId: string): Promise<void> {
    // Get all videos in program
    const videos = await this.prisma.video.findMany({
      where: { programId },
    });

    if (videos.length === 0) return;

    // Get user's video views for this program
    const views = await this.prisma.videoView.findMany({
      where: {
        userId,
        videoId: { in: videos.map((v) => v.id) },
      },
    });

    // Calculate overall progress
    const totalProgress = views.reduce((sum, v) => sum + v.progress, 0);
    const overallProgress = totalProgress / videos.length;
    const allCompleted = views.length === videos.length && views.every((v) => v.completed);

    // Get enrollment
    const enrollment = await this.prisma.programEnrollment.findUnique({
      where: {
        userId_programId: { userId, programId },
      },
      include: {
        program: true,
        user: true,
      },
    });

    if (!enrollment) return;

    // Check if just completed
    const wasCompleted = enrollment.completed;
    const isNowCompleted = allCompleted;

    // Update enrollment
    await this.prisma.programEnrollment.update({
      where: {
        userId_programId: { userId, programId },
      },
      data: {
        overallProgress,
        completed: allCompleted,
        completedAt: allCompleted && !wasCompleted ? new Date() : enrollment.completedAt,
      },
    });

    // If just completed, trigger completion workflow
    if (isNowCompleted && !wasCompleted) {
      await this.handleProgramCompletion(enrollment);
    }
  }

  /**
   * Handle program completion (send emails, process payments, generate certificate)
   */
  private async handleProgramCompletion(enrollment: any): Promise<void> {
    this.logger.log(`Program completed: ${enrollment.programId} by user ${enrollment.userId}`);

    const { user, program } = enrollment;

    // Update user activity count
    await this.prisma.user.update({
      where: { id: enrollment.userId },
      data: {
        activitiesCompleted: { increment: 1 },
      },
    });

    // Send completion email
    await this.queueService.sendEmail(
      user.email,
      `Congratulations! You completed ${program.title}`,
      `You have earned ${program.creditAmount} CME credits. Your certificate will be available shortly.`,
    );

    // Generate CME certificate
    await this.queueService.generateCertificate(
      enrollment.userId,
      enrollment.programId,
      program.creditAmount,
    );

    // Process honorarium payment if applicable
    if (program.honorariumAmount) {
      await this.queueService.processPayment(
        enrollment.userId,
        program.honorariumAmount,
        'HONORARIUM',
        enrollment.programId,
      );
    }

    this.logger.log(`Completion workflow triggered for program ${enrollment.programId}`);
  }
}
