import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { SqsService } from '../../queue/sqs.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
    private sqsService: SqsService,
  ) {}

  async create(createUserDto: CreateUserDto) {
    // Check if user already exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email: createUserDto.email },
    });

    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    // Check if authId already exists
    const existingAuthId = await this.prisma.user.findUnique({
      where: { authId: createUserDto.authId },
    });

    if (existingAuthId) {
      throw new ConflictException('User with this Auth0 ID already exists');
    }

    // Create user
    const user = await this.prisma.user.create({
      data: createUserDto,
    });

    // Queue welcome email (async, don't await)
    this.sqsService
      .sendWelcomeEmail(
        user.email,
        `${user.firstName} ${user.lastName}`,
      )
      .catch((error) => {
        console.error('Failed to queue welcome email:', error);
        // Don't fail user creation if email queuing fails
      });

    return user;
  }

  async findAll(page = 1, limit = 10) {
    const skip = (page - 1) * limit;

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count(),
    ]);

    return {
      data: users,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    return user;
  }

  async findByAuthId(authId: string) {
    return this.prisma.user.findUnique({
      where: { authId },
    });
  }

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email },
    });
  }

  async update(id: string, updateUserDto: UpdateUserDto) {
    // Check if user exists
    await this.findOne(id);

    // Update user
    return this.prisma.user.update({
      where: { id },
      data: updateUserDto,
    });
  }

  async remove(id: string) {
    // Check if user exists
    await this.findOne(id);

    // Delete user
    return this.prisma.user.delete({
      where: { id },
    });
  }
}