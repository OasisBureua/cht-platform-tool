import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { QueueService } from '../../queue/queue.service';
import { ProgramRegistrationsService } from '../programs/program-registrations.service';
import { extractJotformFormIdFromUrl } from '../../utils/jotform-form-id';
import { effectiveWebinarIntakeFormUrl } from '../../utils/webinar-intake-url';

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
    private programRegistrations: ProgramRegistrationsService,
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

    if (survey) {
      return this.processSurveySubmission(payload, survey, String(submissionId));
    }

    let webinarProgramId = await this.findWebinarProgramIdForIntakeForm(String(formId));
    if (!webinarProgramId) {
      webinarProgramId = await this.resolveWebinarProgramIdFromPayload(String(formId), payload);
    }
    if (webinarProgramId) {
      return this.processWebinarIntakeSubmission(payload, String(submissionId), webinarProgramId);
    }

    this.logger.warn(`Jotform webhook: no survey or webinar intake match for formID ${formId}`);
    return { received: true };
  }

  private async processSurveySubmission(
    payload: JotformWebhookPayload,
    survey: { id: string; programId: string },
    submissionId: string,
  ): Promise<{ received: boolean; surveyResponseId?: string }> {
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

  private async findWebinarProgramIdForIntakeForm(formId: string): Promise<string | null> {
    const programs = await this.prisma.program.findMany({
      where: {
        status: 'PUBLISHED',
        zoomSessionType: 'WEBINAR',
        jotformIntakeFormUrl: { not: null },
      },
      select: { id: true, jotformIntakeFormUrl: true },
    });
    const matches = programs.filter(
      (p) => extractJotformFormIdFromUrl(p.jotformIntakeFormUrl!) === String(formId),
    );
    if (matches.length === 1) return matches[0].id;
    if (matches.length > 1) {
      this.logger.warn(
        `Jotform webhook: multiple programs use intake form ${formId}; add hidden field program_id to submissions`,
      );
      return null;
    }

    const defaultUrl = this.config.get<string>('jotform.webinarDefaultIntakeUrl')?.trim();
    const defaultFormId = defaultUrl ? extractJotformFormIdFromUrl(defaultUrl) : null;
    if (!defaultFormId || String(formId) !== defaultFormId) return null;

    const noPerProgramUrl = await this.prisma.program.findMany({
      where: {
        status: 'PUBLISHED',
        zoomSessionType: 'WEBINAR',
        OR: [{ jotformIntakeFormUrl: null }, { jotformIntakeFormUrl: '' }],
      },
      select: { id: true },
    });
    if (noPerProgramUrl.length === 1) return noPerProgramUrl[0].id;
    if (noPerProgramUrl.length > 1) {
      this.logger.warn(
        `Jotform webhook: default intake form ${formId} matches several webinars without a per-program intake URL; require hidden program_id on the form`,
      );
    }
    return null;
  }

  /** When several webinars share one intake form, resolve program from hidden `program_id` + form id. */
  private async resolveWebinarProgramIdFromPayload(
    formId: string,
    payload: JotformWebhookPayload,
  ): Promise<string | null> {
    const pid = this.extractProgramId(payload);
    if (!pid) return null;
    const p = await this.prisma.program.findFirst({
      where: {
        id: pid,
        status: 'PUBLISHED',
        zoomSessionType: 'WEBINAR',
      },
      select: { id: true, jotformIntakeFormUrl: true, zoomSessionType: true },
    });
    if (!p) return null;
    const effective = effectiveWebinarIntakeFormUrl(
      p.zoomSessionType,
      p.jotformIntakeFormUrl,
      this.config.get<string>('jotform.webinarDefaultIntakeUrl')?.trim() || undefined,
    );
    if (!effective) return null;
    const parsed = extractJotformFormIdFromUrl(effective);
    return parsed === String(formId) ? p.id : null;
  }

  private async processWebinarIntakeSubmission(
    payload: JotformWebhookPayload,
    submissionId: string,
    resolvedProgramId: string,
  ): Promise<{ received: boolean }> {
    const userId = this.extractUserId(payload);
    if (!userId) {
      this.logger.warn(
        `Jotform intake webhook: no user_id in submission ${submissionId}. Add hidden field "user_id" to the intake form.`,
      );
      return { received: true };
    }

    const programId = resolvedProgramId;
    const payloadPid = this.extractProgramId(payload);
    if (payloadPid && payloadPid !== programId) {
      this.logger.warn(
        `Jotform intake webhook: submission includes program_id ${payloadPid} but form resolved to program ${programId}; using resolved program`,
      );
    }

    const userExists = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!userExists) {
      this.logger.warn(`Jotform intake webhook: user ${userId} not found`);
      return { received: true };
    }

    await this.programRegistrations.recordWebinarIntakeFromJotformWebhook(userId, programId, String(submissionId));
    return { received: true };
  }

  private extractProgramId(payload: JotformWebhookPayload): string | null {
    const v = payload.program_id ?? payload.programId;
    if (typeof v === 'string' && v.trim()) return v.trim();
    if (typeof v === 'number') return String(v);
    return null;
  }

  private extractUserId(payload: JotformWebhookPayload): string | null {
    const v = payload.user_id ?? payload.userId ?? payload.cht_user_id ?? payload.chtUserId;
    if (typeof v === 'string' && v.trim()) return v.trim();
    if (typeof v === 'number') return String(v);
    return null;
  }

  private buildAnswersFromPayload(payload: JotformWebhookPayload): Record<string, unknown> {
    const exclude = [
      'submissionID',
      'submission_id',
      'formID',
      'form_id',
      'rawRequest',
      'user_id',
      'userId',
      'cht_user_id',
      'chtUserId',
      'program_id',
      'programId',
    ];
    const answers: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(payload)) {
      if (exclude.includes(key) || value === undefined) continue;
      answers[key] = value;
    }
    return answers;
  }
}
