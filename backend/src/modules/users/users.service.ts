import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async create(createUserDto: CreateUserDto) {
    // Check if user already exists
    const existing = await this.prisma.user.findUnique({
      where: { email: createUserDto.email },
    });

    if (existing) {
      throw new ConflictException('User with this email already exists');
    }

    // Remove undefined fields
    const data = this.removeUndefined(createUserDto);

    // Create the user
    return this.prisma.user.create({
      data,
    });
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

  async update(id: string, updateUserDto: UpdateUserDto) {
    try {
      // Remove undefined fields
      const data = this.removeUndefined(updateUserDto);

      return await this.prisma.user.update({
        where: { id },
        data,
      });
    } catch (error) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }
  }

  async remove(id: string) {
    try {
      return await this.prisma.user.delete({
        where: { id },
      });
    } catch (error) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }
  }

  // Helper method to remove undefined fields
  private removeUndefined(obj: any): any {
    return Object.fromEntries(
      Object.entries(obj).filter(([_, value]) => value !== undefined)
    );
  }
}