import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { QueueService } from '../../queue/queue.service';
import { CreateProgramDto } from './dto/create-program.dto';
import { UpdateProgramDto } from './dto/update-program.dto';

@Injectable()
export class ProgramsService {
  constructor(
    private prisma: PrismaService,
    private queueService: QueueService,
  ) {}

  async create(createProgramDto: CreateProgramDto) {
    const data = this.removeUndefined(createProgramDto);
    return this.prisma.program.create({
      data,
    });
  }

  async findAll(page = 1, limit = 10, status?: string) {
    const skip = (page - 1) * limit;
    const where = status ? { status } : {};

    const [programs, total] = await Promise.all([
      this.prisma.program.findMany({
        where,
        skip,
        take: limit,
        include: {
          _count: {
            select: {
              videos: true,
              enrollments: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.program.count({ where }),
    ]);

    return {
      data: programs,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string) {
    const program = await this.prisma.program.findUnique({
      where: { id },
      include: {
        videos: {
          orderBy: { order: 'asc' },
        },
        surveys: true,
        _count: {
          select: {
            enrollments: true,
          },
        },
      },
    });

    if (!program) {
      throw new NotFoundException(`Program with ID ${id} not found`);
    }

    return program;
  }

  async update(id: string, updateProgramDto: UpdateProgramDto) {
    try {
      const data = this.removeUndefined(updateProgramDto);
      return await this.prisma.program.update({
        where: { id },
        data,
      });
    } catch (error) {
      throw new NotFoundException(`Program with ID ${id} not found`);
    }
  }

  async remove(id: string) {
    try {
      return await this.prisma.program.delete({
        where: { id },
      });
    } catch (error) {
      throw new NotFoundException(`Program with ID ${id} not found`);
    }
  }

  async enroll(programId: string, userId: string) {
    const program = await this.prisma.program.findUnique({
      where: { id: programId },
    });

    if (!program) {
      throw new NotFoundException(`Program with ID ${programId} not found`);
    }

    const existing = await this.prisma.programEnrollment.findUnique({
      where: {
        userId_programId: {
          userId,
          programId,
        },
      },
    });

    if (existing) {
      return existing;
    }

    const enrollment = await this.prisma.programEnrollment.create({
      data: {
        userId,
        programId,
      },
      include: {
        program: true,
        user: true,
      },
    });

    // Queue enrollment confirmation email
    await this.queueService.sendEnrollmentConfirmation(
      enrollment.user.email,
      enrollment.program.title,
    );

    return enrollment;
  }

  async getEnrollments(programId: string) {
    return this.prisma.programEnrollment.findMany({
      where: { programId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            specialty: true,
            state: true,
          },
        },
      },
      orderBy: { enrolledAt: 'desc' },
    });
  }

  async getUserEnrollments(userId: string) {
    return this.prisma.programEnrollment.findMany({
      where: { userId },
      include: {
        program: true,
      },
      orderBy: { enrolledAt: 'desc' },
    });
  }

  private removeUndefined(obj: any): any {
    return Object.fromEntries(
      Object.entries(obj).filter(([_, value]) => value !== undefined)
    );
  }
}
