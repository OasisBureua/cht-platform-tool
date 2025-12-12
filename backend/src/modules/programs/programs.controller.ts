import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  ParseIntPipe,
} from '@nestjs/common';
import { ProgramsService } from './programs.service';
import { CreateProgramDto } from './dto/create-program.dto';
import { UpdateProgramDto } from './dto/update-program.dto';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { Roles } from '../../auth/decorators/roles.decorator';
import { Public } from '../../auth/decorators/public.decorator';

@Controller('programs')
export class ProgramsController {
  constructor(private readonly programsService: ProgramsService) {}

  @Post()
  @Public()  // ← Make public for testing
  create(@Body() createProgramDto: CreateProgramDto) {
    return this.programsService.create(createProgramDto);
  }

  @Get()
  @Public()  // ← Make public for testing
  findAll(
    @Query('page', new ParseIntPipe({ optional: true })) page?: number,
    @Query('limit', new ParseIntPipe({ optional: true })) limit?: number,
    @Query('status') status?: string,
  ) {
    return this.programsService.findAll(page, limit, status);
  }

  @Get('my-enrollments')
  getMyEnrollments(@CurrentUser() user: any) {
    return this.programsService.getUserEnrollments(user.userId);
  }

  @Get(':id')
  @Public()  // ← Make public for testing
  findOne(@Param('id') id: string) {
    return this.programsService.findOne(id);
  }

  @Post(':id/enroll')
  enroll(@Param('id') programId: string, @CurrentUser() user: any) {
    return this.programsService.enroll(programId, user.userId);
  }

  @Get(':id/enrollments')
  @Roles('ADMIN')
  getEnrollments(@Param('id') id: string) {
    return this.programsService.getEnrollments(id);
  }

  @Patch(':id')
  @Public()  // ← Make public for testing
  update(@Param('id') id: string, @Body() updateProgramDto: UpdateProgramDto) {
    return this.programsService.update(id, updateProgramDto);
  }

  @Delete(':id')
  @Roles('ADMIN')
  remove(@Param('id') id: string) {
    return this.programsService.remove(id);
  }
}
