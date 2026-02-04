import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { CurrentUser } from '../../auth/current-user.decorator';
import { AuthUser } from '../../auth/auth.service';
import { SurveysService } from './surveys.service';
import { SubmitSurveyResponseDto } from './dto/submit-survey-response.dto';

@Controller('surveys')
export class SurveysController {
  constructor(private readonly surveysService: SurveysService) {}

  /**
   * GET /api/surveys
   * List all surveys (public for now)
   */
  @Get()
  async getAll() {
    return this.surveysService.getAll();
  }

  /**
   * GET /api/surveys/:id
   * Get survey by ID (public)
   */
  @Get(':id')
  async getById(@Param('id') id: string) {
    return this.surveysService.getById(id);
  }

  /**
   * POST /api/surveys/:surveyId/responses
   * Submit a survey response (auth required).
   * Queues SURVEY_BONUS payment if configured.
   */
  @Post(':id/responses')
  @UseGuards(JwtAuthGuard)
  async submitResponse(
    @CurrentUser() user: AuthUser,
    @Param('id') surveyId: string,
    @Body() dto: SubmitSurveyResponseDto,
  ) {
    return this.surveysService.submitResponse(surveyId, user.userId, dto);
  }
}
