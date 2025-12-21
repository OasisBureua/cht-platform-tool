import { Controller, Get, Post, Body, Param, Logger } from '@nestjs/common';
import { ProgramsService } from './programs.service';
import { EnrollUserDto, EnrollmentResponseDto } from './dto/enroll-user.dto';
import { ProgramResponseDto } from './dto/program-response.dto';
import { UpdateVideoProgressDto, VideoProgressResponseDto } from './dto/update-video-progress.dto';

@Controller('programs')
export class ProgramsController {
  private readonly logger = new Logger(ProgramsController.name);

  constructor(private readonly programsService: ProgramsService) {}

  /**
   * GET /api/programs
   * Get all published programs
   */
  @Get()
  async getAllPrograms(): Promise<ProgramResponseDto[]> {
    this.logger.log('Getting all programs');
    return this.programsService.getAllPrograms();
  }

  /**
   * GET /api/programs/:id
   * Get single program by ID
   */
  @Get(':id')
  async getProgramById(@Param('id') id: string): Promise<ProgramResponseDto> {
    this.logger.log(`Getting program: ${id}`);
    return this.programsService.getProgramById(id);
  }

  /**
   * POST /api/programs/enroll
   * Enroll user in program
   */
  @Post('enroll')
  async enrollUser(@Body() dto: EnrollUserDto): Promise<EnrollmentResponseDto> {
    this.logger.log(`Enrolling user ${dto.userId} in program ${dto.programId}`);
    return this.programsService.enrollUser(dto);
  }

  /**
   * GET /api/programs/enrollments/:userId
   * Get user's enrollments
   */
  @Get('enrollments/:userId')
  async getUserEnrollments(@Param('userId') userId: string) {
    this.logger.log(`Getting enrollments for user: ${userId}`);
    return this.programsService.getUserEnrollments(userId);
  }

  /**
   * POST /api/programs/video-progress
   * Update video progress
   */
  @Post('video-progress')
  async updateVideoProgress(@Body() dto: UpdateVideoProgressDto): Promise<VideoProgressResponseDto> {
    this.logger.debug(`Updating video progress for user: ${dto.userId}`);
    return this.programsService.updateVideoProgress(dto);
  }
}
