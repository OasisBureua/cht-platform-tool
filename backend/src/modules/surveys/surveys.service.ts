import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { QueueService } from '../../queue/queue.service';
import { SubmitSurveyResponseDto } from './dto/submit-survey-response.dto';

@Injectable()
export class SurveysService {
  private readonly logger = new Logger(SurveysService.name);

  constructor(
    private prisma: PrismaService,
    private queueService: QueueService,
    private configService: ConfigService,
  ) {}

  /**
   * Get all surveys (for programs user has access to)
   */
  async getAll() {
    const surveys = await this.prisma.survey.findMany({
      include: {
        program: {
          select: { id: true, title: true, sponsorName: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    return surveys.map((s) => ({
      id: s.id,
      programId: s.programId,
      title: s.title,
      description: s.description,
      type: s.type,
      required: s.required,
      jotformFormId: s.jotformFormId,
      createdAt: s.createdAt.toISOString(),
      updatedAt: s.updatedAt.toISOString(),
      program: s.program,
    }));
  }

  /**
   * Get survey by ID
   */
  async getById(id: string) {
    const survey = await this.prisma.survey.findUnique({
      where: { id },
      include: {
        program: {
          select: { id: true, title: true, sponsorName: true },
        },
      },
    });
    if (!survey) throw new NotFoundException('Survey not found');
    return {
      id: survey.id,
      programId: survey.programId,
      title: survey.title,
      description: survey.description,
      questions: survey.questions,
      type: survey.type,
      required: survey.required,
      jotformFormId: survey.jotformFormId,
      createdAt: survey.createdAt.toISOString(),
      updatedAt: survey.updatedAt.toISOString(),
      program: survey.program,
    };
  }

  /**
   * Submit a survey response.
   * Creates SurveyResponse in DB and sends SURVEY_BONUS payment message if configured.
   */
  async submitResponse(
    surveyId: string,
    userId: string,
    dto: SubmitSurveyResponseDto,
  ): Promise<{ id: string; submittedAt: string }> {
    const survey = await this.prisma.survey.findUnique({
      where: { id: surveyId },
      include: { program: true },
    });

    if (!survey) {
      throw new NotFoundException('Survey not found');
    }

    // Check if already submitted
    const existing = await this.prisma.surveyResponse.findUnique({
      where: {
        userId_surveyId: { userId, surveyId },
      },
    });

    if (existing) {
      throw new BadRequestException('Survey already submitted');
    }

    const response = await this.prisma.surveyResponse.create({
      data: {
        userId,
        surveyId,
        answers: dto.answers as object,
        score: dto.score,
      },
    });

    this.logger.log(`Survey ${surveyId} submitted by user ${userId}`);

    // Send SURVEY_BONUS payment message if amount is configured
    const surveyBonusAmount = this.configService.get<number>('surveys.bonusAmountCents');
    if (surveyBonusAmount && surveyBonusAmount > 0) {
      await this.queueService.processPayment(
        userId,
        surveyBonusAmount,
        'SURVEY_BONUS',
        survey.programId,
      );
      this.logger.log(`Queued SURVEY_BONUS payment for user ${userId}: $${surveyBonusAmount / 100}`);
    }

    return {
      id: response.id,
      submittedAt: response.submittedAt.toISOString(),
    };
  }
}
