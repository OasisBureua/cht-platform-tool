import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ProgramsService } from './programs.service';
import { CreateProgramDto } from './dto/create-program.dto';
import { UpdateProgramDto } from './dto/update-program.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { Public } from '../../auth/decorators/public.decorator';

@Controller('programs')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ProgramsController {
  constructor(private readonly programsService: ProgramsService) {}

  @Post()
  @Roles('ADMIN')
  @Public() // Temporarily public for testing
  create(@Body() createProgramDto: CreateProgramDto) {
    return this.programsService.create(createProgramDto);
  }

  @Get()
  @Public() // Temporarily public for testing
  findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: string,
  ) {
    return this.programsService.findAll(
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 10,
      status,
    );
  }

  @Get('my-enrollments')
  getMyEnrollments(@Request() req) {
    return this.programsService.getMyEnrollments(req.user.userId);
  }

  @Get(':id')
  @Public() // Temporarily public for testing
  findOne(@Param('id') id: string) {
    return this.programsService.findOne(id);
  }

  @Get(':id/enrollments')
  @Roles('ADMIN')
  getProgramEnrollments(@Param('id') id: string) {
    return this.programsService.getProgramEnrollments(id);
  }

  @Post(':id/enroll')
  enroll(@Param('id') id: string, @Request() req) {
    return this.programsService.enroll(id, req.user.userId);
  }

  @Patch(':id')
  @Roles('ADMIN')
  update(@Param('id') id: string, @Body() updateProgramDto: UpdateProgramDto) {
    return this.programsService.update(id, updateProgramDto);
  }

  @Delete(':id')
  @Roles('ADMIN')
  remove(@Param('id') id: string) {
    return this.programsService.remove(id);
  }
}

