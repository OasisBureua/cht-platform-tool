import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RolesGuard } from '../../auth/roles.guard';
import { Roles } from '../../auth/roles.decorator';
import { ProgramsService } from '../programs/programs.service';
import { SurveysService } from '../surveys/surveys.service';
import { CreateProgramDto } from './dto/create-program.dto';
import { CreateSurveyDto } from './dto/create-survey.dto';
import { UpdateProgramStatusDto } from './dto/update-program-status.dto';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class AdminController {
  constructor(
    private programsService: ProgramsService,
    private surveysService: SurveysService,
  ) {}

  @Get('programs')
  getAllPrograms() {
    return this.programsService.getAllProgramsForAdmin();
  }

  @Post('programs')
  createProgram(@Body() dto: CreateProgramDto) {
    return this.programsService.createProgram(dto);
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
}
