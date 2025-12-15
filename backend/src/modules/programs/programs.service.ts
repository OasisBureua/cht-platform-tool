import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { SqsService } from '../../queue/sqs.service';
import { CreateProgramDto } from './dto/create-program.dto';
import { UpdateProgramDto } from './dto/update-program.dto';

@Injectable()
export class ProgramsService {
  constructor(
    private prisma: PrismaService,
    private sqsService: SqsService,
  ) {}

  async create(createProgramDto: CreateProgramDto) {
    return this.prisma.program.create({
      data: createProgramDto,
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
        orderBy: { createdAt: 'desc' },
        include: {
          _count: {
            select: {
              videos: true,
              enrollments: true,
            },
          },
        },
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
    // Check if program exists
    await this.findOne(id);

    return this.prisma.program.update({
      where: { id },
      data: updateProgramDto,
    });
  }

  async remove(id: string) {
    // Check if program exists
    await this.findOne(id);

    return this.prisma.program.delete({
      where: { id },
    });
  }

  // ============================================================================
  // ENROLLMENT METHODS
  // ============================================================================

  async enroll(programId: string, userId: string) {
    // Check if program exists and is active
    const program = await this.findOne(programId);

    if (program.status !== 'ACTIVE') {
      throw new BadRequestException('Program is not currently active');
    }

    // Check if already enrolled
    const existingEnrollment = await this.prisma.programEnrollment.findUnique({
      where: {
        userId_programId: {
          userId,
          programId,
        },
      },
    });

    if (existingEnrollment) {
      throw new BadRequestException('User is already enrolled in this program');
    }

    // Create enrollment
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

    // Queue enrollment confirmation email (async)
    this.sqsService
      .sendEnrollmentConfirmation(
        enrollment.user.email,
        enrollment.program.title,
      )
      .catch((error) => {
        console.error('Failed to queue enrollment email:', error);
        // Don't fail enrollment if email queuing fails
      });

    return enrollment;
  }

  async getMyEnrollments(userId: string) {
    return this.prisma.programEnrollment.findMany({
      where: { userId },
      include: {
        program: true,
      },
      orderBy: { enrolledAt: 'desc' },
    });
  }

  async getProgramEnrollments(programId: string) {
    // Check if program exists
    await this.findOne(programId);

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
}