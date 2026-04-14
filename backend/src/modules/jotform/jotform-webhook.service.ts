import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { QueueService } from '../../queue/queue.service';

interface JotformWebhookPayload {
  submissionID?: string;
  submission_id?: string;
  formID?: string;
  form_id?: string;
  rawRequest?: string;
  [key: string]: unknown;
}

@Injectable()
export class JotformWebhookService {
  private readonly logger = new Logger(JotformWebhookService.name);

  constructor(
    private prisma: PrismaService,
    private queueService: QueueService,
    private config: ConfigService,
  ) {}

  async processSubmission(rawRequest: string): Promise<{ received: boolean; surveyResponseId?: string }> {
    let payload: JotformWebhookPayload;
    try {
      payload = JSON.parse(rawRequest) as JotformWebhookPayload;
    } catch {
      throw new BadRequestException('Invalid rawRequest JSON');
    }

    const submissionId =
      payload.submissionID ?? payload.submission_id ?? (payload as { submissionID?: string }).submissionID;
    const formId = payload.formID ?? payload.form_id;

    if (!submissionId || !formId) {
      this.logger.warn(`Jotform webhook: missing submissionID or formID in payload`);
      return { received: true };
    }

    const survey = await this.prisma.survey.findFirst({
      where: { jotformFormId: String(formId) },
      include: { program: true },
    });

    if (!survey) {
      this.logger.warn(`Jotform webhook: no survey found for formID ${formId}`);
      return { received: true };
    }

    const userId = this.extractUserId(payload);
    if (!userId) {
      this.logger.warn(
        `Jotform webhook: no user_id in submission ${submissionId}. Add hidden field "user_id" when embedding form.`,
      );
      return { received: true };
    }

    const existing = await this.prisma.surveyResponse.findUnique({
      where: { jotformSubmissionId: String(submissionId) },
    });
    if (existing) {
      this.logger.log(`Jotform webhook: submission ${submissionId} already processed`);
      return { received: true, surveyResponseId: existing.id };
    }

    const userExists = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    if (!userExists) {
      this.logger.warn(`Jotform webhook: user ${userId} not found`);
      return { received: true };
    }

    const existingUserResponse = await this.prisma.surveyResponse.findUnique({
      where: { userId_surveyId: { userId, surveyId: survey.id } },
    });
    if (existingUserResponse) {
      this.logger.warn(`Jotform webhook: user ${userId} already submitted survey ${survey.id}`);
      return { received: true };
    }

    const answers = this.buildAnswersFromPayload(payload);

    const response = await this.prisma.surveyResponse.create({
      data: {
        userId,
        surveyId: survey.id,
        answers: answers as object,
        jotformSubmissionId: String(submissionId),
      },
    });

    this.logger.log(`Survey ${survey.id} submitted via Jotform by user ${userId} (submission ${submissionId})`);

    const surveyBonusAmount = this.config.get<number>('surveys.bonusAmountCents');
    if (surveyBonusAmount && surveyBonusAmount > 0) {
      await this.queueService.processPayment(
        userId,
        surveyBonusAmount,
        'SURVEY_BONUS',
        survey.programId,
      );
      this.logger.log(`Queued SURVEY_BONUS payment for user ${userId}`);
    }

    return { received: true, surveyResponseId: response.id };
  }

  private extractUserId(payload: JotformWebhookPayload): string | null {
    const v = payload.user_id ?? payload.userId ?? payload.cht_user_id ?? payload.chtUserId;
    if (typeof v === 'string' && v.trim()) return v.trim();
    if (typeof v === 'number') return String(v);
    return null;
  }

  private buildAnswersFromPayload(payload: JotformWebhookPayload): Record<string, unknown> {
    const exclude = ['submissionID', 'submission_id', 'formID', 'form_id', 'rawRequest', 'user_id', 'userId', 'cht_user_id', 'chtUserId'];
    const answers: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(payload)) {
      if (exclude.includes(key) || value === undefined) continue;
      answers[key] = value;
    }
    return answers;
  }
}
