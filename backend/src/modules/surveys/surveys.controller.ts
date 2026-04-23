import { Controller, Get, Post, Put, Body, Param, UseGuards } from '@nestjs/common';
import { FormJotformScope } from '../programs/form-jotform-scope';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { CurrentUser } from '../../auth/current-user.decorator';
import { AuthUser } from '../../auth/auth.service';
import { SurveysService } from './surveys.service';
import { SubmitSurveyResponseDto } from './dto/submit-survey-response.dto';
import { JotformResumeDto } from './dto/jotform-resume.dto';
import { FormJotformProgressService } from '../programs/form-jotform-progress.service';

@Controller('surveys')
export class SurveysController {
  constructor(
    private readonly surveysService: SurveysService,
    private readonly formJotformProgress: FormJotformProgressService,
  ) {}

  /**
   * GET /api/surveys
   * List all surveys (public for now)
   */
  @Get()
  async getAll() {
    return this.surveysService.getAll();
  }

  /**
   * GET /api/surveys/:id/my-response
   * Whether the current user has a saved response (including via Jotform webhook).
   */
  @Get(':id/my-response')
  @UseGuards(JwtAuthGuard)
  async getMyResponse(@CurrentUser() user: AuthUser, @Param('id') surveyId: string) {
    return this.surveysService.getMyResponseStatus(surveyId, user.userId);
  }

  /**
   * GET /api/surveys/:id/jotform-resume — saved Jotform session for Save & Continue (24h)
   */
  @Get(':id/jotform-resume')
  @UseGuards(JwtAuthGuard)
  async getSurveyJotformResume(@Param('id') surveyId: string, @CurrentUser() user: AuthUser) {
    return this.formJotformProgress.getResumeSession(user.userId, FormJotformScope.SURVEY, surveyId);
  }

  /**
   * PUT /api/surveys/:id/jotform-resume
   */
  @Put(':id/jotform-resume')
  @UseGuards(JwtAuthGuard)
  async putSurveyJotformResume(
    @Param('id') surveyId: string,
    @CurrentUser() user: AuthUser,
    @Body() body: JotformResumeDto,
  ) {
    await this.formJotformProgress.saveResumeSession(
      user.userId,
      FormJotformScope.SURVEY,
      surveyId,
      body.sessionId,
    );
    return { ok: true as const };
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
