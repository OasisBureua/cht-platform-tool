import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RolesGuard } from '../../auth/roles.guard';
import { Roles } from '../../auth/roles.decorator';
import { ProgramsService } from '../programs/programs.service';
import { SurveysService } from '../surveys/surveys.service';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateProgramDto } from './dto/create-program.dto';
import { CreateSurveyDto } from './dto/create-survey.dto';
import { CreateSurveyFromJotformDto } from './dto/create-survey-from-jotform.dto';
import { UpdateProgramStatusDto } from './dto/update-program-status.dto';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminController {
  constructor(
    private programsService: ProgramsService,
    private surveysService: SurveysService,
    private prisma: PrismaService,
  ) {}

  @Get('programs')
  getAllPrograms() {
    return this.programsService.getAllProgramsForAdmin();
  }

  @Post('programs')
  async createProgram(@Body() dto: CreateProgramDto) {
    const program = await this.programsService.createProgram(dto);
    if (dto.createSurveyFromTemplate?.trim()) {
      await this.surveysService.createSurveyFromJotformTemplate({
        programId: program.id,
        templateFormId: dto.createSurveyFromTemplate.trim(),
        title: `${program.title} - Post Event Survey`,
        type: 'FEEDBACK',
      });
    }
    return program;
  }

  @Patch('programs/:id/status')
  updateProgramStatus(
    @Param('id') id: string,
    @Body() dto: UpdateProgramStatusDto,
  ) {
    return this.programsService.updateProgramStatus(id, dto.status);
  }

  @Post('surveys')
  createSurvey(@Body() dto: CreateSurveyDto) {
    return this.surveysService.createSurvey(dto);
  }

  /**
   * POST /api/admin/surveys/from-jotform-template
   * Clone a Jotform form template, add webhook, and create a Survey.
   * Use when creating a new webinar/program that needs a unique survey.
   */
  @Post('surveys/from-jotform-template')
  createSurveyFromJotformTemplate(@Body() dto: CreateSurveyFromJotformDto) {
    return this.surveysService.createSurveyFromJotformTemplate(dto);
  }

  /**
   * GET /api/admin/users
   * List users for admin (HCP explorer, role management).
   */
  @Get('users')
  async getUsers() {
    const users = await this.prisma.user.findMany({
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        status: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
    return users;
  }

  /**
   * PATCH /api/admin/users/:userId/role
   * Promote or demote user role (admin only). Cannot demote self.
   */
  @Patch('users/:userId/role')
  async updateUserRole(
    @Param('userId') userId: string,
    @Body('role') role: UserRole,
  ) {
    if (!role || !['HCP', 'KOL', 'ADMIN'].includes(role)) {
      throw new BadRequestException('Invalid role. Must be HCP, KOL, or ADMIN.');
    }
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { role },
      select: { id: true, email: true, role: true },
    });
    return updated;
  }
}
