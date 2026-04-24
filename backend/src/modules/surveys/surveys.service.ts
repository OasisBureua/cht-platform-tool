import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { QueueService } from '../../queue/queue.service';
import { HubSpotService } from '../hubspot/hubspot.service';
import { JotformService } from '../jotform/jotform.service';
import { SubmitSurveyResponseDto } from './dto/submit-survey-response.dto';
import { extractJotformFormIdFromUrl } from '../../utils/jotform-form-id';
import { FormJotformProgressService } from '../programs/form-jotform-progress.service';
import { FormJotformScope } from '../programs/form-jotform-scope';

@Injectable()
export class SurveysService {
  private readonly logger = new Logger(SurveysService.name);

  constructor(
    private prisma: PrismaService,
    private queueService: QueueService,
    private configService: ConfigService,
    private hubspot: HubSpotService,
    private jotformService: JotformService,
    private formJotformProgress: FormJotformProgressService,
  ) {}

  /**
   * Get all surveys (for programs user has access to)
   */
  async getAll() {
    const surveys = await this.prisma.survey.findMany({
      include: {
        program: {
          select: {
            id: true,
            title: true,
            sponsorName: true,
            honorariumAmount: true,
            creditAmount: true,
            zoomSessionType: true,
            startDate: true,
          },
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
      jotformFormUrl: s.jotformFormId ? `https://communityhealthmedia.jotform.com/${s.jotformFormId}` : null,
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
          select: {
            id: true,
            title: true,
            sponsorName: true,
            honorariumAmount: true,
            creditAmount: true,
            zoomSessionType: true,
            startDate: true,
          },
        },
      },
    });
    if (!survey) throw new NotFoundException('Survey not found');
    const jotformFormUrl = survey.jotformFormId
      ? `https://communityhealthmedia.jotform.com/${survey.jotformFormId}`
      : null;
    return {
      id: survey.id,
      programId: survey.programId,
      title: survey.title,
      description: survey.description,
      questions: survey.questions,
      type: survey.type,
      required: survey.required,
      jotformFormId: survey.jotformFormId,
      jotformFormUrl,
      createdAt: survey.createdAt.toISOString(),
      updatedAt: survey.updatedAt.toISOString(),
      program: survey.program,
    };
  }

  /**
   * Whether the user already has a stored response (native submit or Jotform webhook).
   */
  async getMyResponseStatus(
    surveyId: string,
    userId: string,
  ): Promise<{ submitted: boolean; responseId?: string; submittedAt?: string }> {
    const survey = await this.prisma.survey.findUnique({
      where: { id: surveyId },
      select: { id: true },
    });
    if (!survey) throw new NotFoundException('Survey not found');

    const row = await this.prisma.surveyResponse.findUnique({
      where: { userId_surveyId: { userId, surveyId } },
      select: { id: true, submittedAt: true },
    });
    if (!row) {
      return { submitted: false };
    }
    return {
      submitted: true,
      responseId: row.id,
      submittedAt: row.submittedAt.toISOString(),
    };
  }

  /**
   * Create survey (admin)
   */
  async createSurvey(dto: {
    programId: string;
    title: string;
    description?: string;
    questions: Record<string, unknown>[];
    type?: 'PRE_TEST' | 'POST_TEST' | 'FEEDBACK';
    required?: boolean;
    jotformFormId?: string;
  }) {
    const program = await this.prisma.program.findUnique({
      where: { id: dto.programId },
    });
    if (!program) {
      throw new BadRequestException('Program not found');
    }

    const survey = await this.prisma.survey.create({
      data: {
        programId: dto.programId,
        title: dto.title,
        description: dto.description,
        questions: dto.questions as object,
        type: dto.type ?? 'POST_TEST',
        required: dto.required ?? true,
        jotformFormId: dto.jotformFormId?.trim() || null,
      },
    });
    this.logger.log(`Survey created: ${survey.id} - ${survey.title}`);
    return survey;
  }

  /**
   * Update survey (admin). Only jotformFormId is updatable for now.
   */
  async updateSurvey(id: string, dto: { jotformFormId?: string }) {
    const survey = await this.prisma.survey.findUnique({ where: { id } });
    if (!survey) throw new NotFoundException('Survey not found');

    const updated = await this.prisma.survey.update({
      where: { id },
      data: {
        ...(dto.jotformFormId !== undefined && {
          jotformFormId: dto.jotformFormId?.trim() || null,
        }),
      },
    });
    if (survey.type === 'FEEDBACK' && dto.jotformFormId !== undefined) {
      const fid = dto.jotformFormId?.trim();
      await this.prisma.program.update({
        where: { id: survey.programId },
        data: {
          jotformSurveyUrl: fid ? `https://communityhealthmedia.jotform.com/${fid}` : null,
        },
      });
    }
    this.logger.log(`Survey ${id} updated (jotformFormId: ${updated.jotformFormId ?? 'null'})`);
    return updated;
  }

  /**
   * Delete survey (admin). Cascades to SurveyResponse records.
   */
  async deleteSurvey(id: string) {
    const survey = await this.prisma.survey.findUnique({ where: { id } });
    if (!survey) throw new NotFoundException('Survey not found');

    await this.prisma.survey.delete({ where: { id } });
    this.logger.log(`Survey deleted: ${id} - ${survey.title}`);
    return { deleted: true, id };
  }

  /**
   * Create a Survey from a Jotform template: clone form, add webhook, create Survey.
   * Use when creating a new webinar/program that needs a unique survey.
   */
  async createSurveyFromJotformTemplate(dto: {
    programId: string;
    templateFormId: string;
    title?: string;
    type?: 'PRE_TEST' | 'POST_TEST' | 'FEEDBACK';
  }) {
    const program = await this.prisma.program.findUnique({
      where: { id: dto.programId },
    });
    if (!program) {
      throw new BadRequestException('Program not found');
    }

    const { formId, title: clonedTitle, url: clonedFormUrl } = await this.jotformService.cloneForm(
      dto.templateFormId,
    );
    await this.jotformService.addWebhook(formId);

    const survey = await this.prisma.survey.create({
      data: {
        programId: dto.programId,
        title: dto.title || clonedTitle,
        jotformFormId: formId,
        questions: { source: 'jotform', formId },
        type: dto.type ?? 'FEEDBACK',
        required: true,
      },
    });

    const jotformFormUrl = clonedFormUrl;
    await this.prisma.program.update({
      where: { id: dto.programId },
      data: { jotformSurveyUrl: jotformFormUrl },
    });

    this.logger.log(`Survey created from Jotform template: ${survey.id} (form ${formId})`);
    return {
      ...survey,
      jotformFormUrl,
    };
  }

  webinarJotformTemplateConfigMessage(): string {
    return (
      'Webinars need invitation and post-event Jotform setup (or a shared post-event form) plus Jotform API access ' +
      'configured on the server. Ask your technical administrator to complete this in the deployment environment.'
    );
  }

  assertJotformConfiguredForWebinarClones(): void {
    const inv = this.configService.get<string>('jotform.invitationTemplateFormId')?.trim();
    const postTemplate = this.configService.get<string>('jotform.postEventTemplateFormId')?.trim();
    const sharedPost = this.configService.get<string>('jotform.postEventSharedFormId')?.trim();
    const apiKey = this.configService.get<string>('jotform.apiKey')?.trim();
    if (!inv || (!sharedPost && !postTemplate)) {
      throw new BadRequestException(this.webinarJotformTemplateConfigMessage());
    }
    if (!apiKey) {
      throw new BadRequestException(
        'A Jotform API key is required to create webinar invitation forms. Ask your technical administrator to configure it.',
      );
    }
  }

  /** Invitation clone only (used when admin supplies a manual post-event Jotform). */
  private assertJotformInvitationCloneRequirements(): void {
    const inv = this.configService.get<string>('jotform.invitationTemplateFormId')?.trim();
    if (!inv) {
      throw new BadRequestException(this.webinarJotformTemplateConfigMessage());
    }
    if (!this.configService.get<string>('jotform.apiKey')?.trim()) {
      throw new BadRequestException(
        'A Jotform API key is required to create webinar invitation forms. Ask your technical administrator to configure it.',
      );
    }
  }

  /**
   * Link an existing Jotform as the program post-event (FEEDBACK) survey; replaces any FEEDBACK rows for this program.
   * Ensures the survey appears in GET /surveys and learners see it after the session.
   */
  async applyManualPostEventJotform(programId: string, programTitle: string, formIdOrUrl: string) {
    const program = await this.prisma.program.findUnique({ where: { id: programId } });
    if (!program) throw new BadRequestException('Program not found');

    const trimmed = formIdOrUrl.trim();
    const formId =
      this.normalizeJotformFormId(trimmed) || extractJotformFormIdFromUrl(trimmed) || '';
    if (!formId) {
      throw new BadRequestException(
        'Enter a valid Jotform form ID or form URL for the post-event survey (e.g. 123456789012345).',
      );
    }

    const jotformFormUrl = `https://communityhealthmedia.jotform.com/${formId}`;

    await this.prisma.survey.deleteMany({ where: { programId, type: 'FEEDBACK' } });

    await this.prisma.survey.create({
      data: {
        programId,
        title: `${programTitle} - Post Event Survey`,
        jotformFormId: formId,
        questions: { source: 'jotform', formId, manualPostEvent: true },
        type: 'FEEDBACK',
        required: true,
      },
    });

    await this.prisma.program.update({
      where: { id: programId },
      data: { jotformSurveyUrl: jotformFormUrl },
    });

    this.logger.log(`Manual post-event Jotform for program ${programId}: form ${formId}`);
  }

  /**
   * Clone invitation from template, then attach admin-provided post-event form (skips env post-event template/shared).
   */
  async createWebinarInvitationAndManualPostSurvey(
    programId: string,
    programTitle: string,
    postEventFormIdOrUrl: string,
  ) {
    this.assertJotformInvitationCloneRequirements();
    const inv = this.configService.get<string>('jotform.invitationTemplateFormId')!.trim();
    await this.createInvitationFormFromJotformTemplate(programId, inv, `${programTitle} - Invitation`);
    await this.applyManualPostEventJotform(programId, programTitle, postEventFormIdOrUrl);
  }

  /**
   * Clone invitation + post-event forms from env template IDs, add webhooks, set program intake URL + FEEDBACK survey.
   */
  async createWebinarJotformPairFromTemplates(programId: string, programTitle: string) {
    this.assertJotformConfiguredForWebinarClones();
    const inv = this.configService.get<string>('jotform.invitationTemplateFormId')!.trim();
    const sharedPost = this.configService.get<string>('jotform.postEventSharedFormId')?.trim();
    await this.createInvitationFormFromJotformTemplate(programId, inv, `${programTitle} - Invitation`);
    if (sharedPost) {
      await this.attachSharedPostEventSurvey(programId, programTitle, sharedPost);
    } else {
      const post = this.configService.get<string>('jotform.postEventTemplateFormId')!.trim();
      await this.createSurveyFromJotformTemplate({
        programId,
        templateFormId: post,
        title: `${programTitle} - Post Event Survey`,
        type: 'FEEDBACK',
      });
    }
  }

  /**
   * Post-event survey only from env (shared form or cloned post template). Use when intake URL is set manually and
   * invitation must not be cloned from the template.
   */
  async createWebinarPostEventOnlyFromTemplates(programId: string, programTitle: string) {
    const sharedPost = this.configService.get<string>('jotform.postEventSharedFormId')?.trim();
    if (sharedPost) {
      await this.attachSharedPostEventSurvey(programId, programTitle, sharedPost);
      return;
    }
    const postTemplate = this.configService.get<string>('jotform.postEventTemplateFormId')?.trim();
    if (!postTemplate) {
      throw new BadRequestException(
        'No Jotform post-event shared form or template is configured. Set JOTFORM_WEBINAR_POST_EVENT_SHARED_FORM_ID or JOTFORM_WEBINAR_POST_EVENT_TEMPLATE_FORM_ID, or provide a manual post-event form when scheduling.',
      );
    }
    if (!this.configService.get<string>('jotform.apiKey')?.trim()) {
      throw new BadRequestException(
        'A Jotform API key is required to clone the post-event survey from the template.',
      );
    }
    await this.createSurveyFromJotformTemplate({
      programId,
      templateFormId: postTemplate,
      title: `${programTitle} - Post Event Survey`,
      type: 'FEEDBACK',
    });
  }

  /**
   * Link program to an existing Jotform for post-event (no clone; webhook should be configured on that form if needed).
   */
  private async attachSharedPostEventSurvey(programId: string, programTitle: string, formIdRaw: string) {
    const program = await this.prisma.program.findUnique({ where: { id: programId } });
    if (!program) throw new BadRequestException('Program not found');

    const formId = this.normalizeJotformFormId(formIdRaw);
    if (!formId) {
      throw new BadRequestException('Invalid JOTFORM_WEBINAR_POST_EVENT_SHARED_FORM_ID');
    }

    const jotformFormUrl = `https://communityhealthmedia.jotform.com/${formId}`;
    await this.prisma.survey.create({
      data: {
        programId,
        title: `${programTitle} - Post Event Survey`,
        jotformFormId: formId,
        questions: { source: 'jotform', formId, sharedPostEvent: true },
        type: 'FEEDBACK',
        required: true,
      },
    });
    await this.prisma.program.update({
      where: { id: programId },
      data: { jotformSurveyUrl: jotformFormUrl },
    });
    this.logger.log(`Shared post-event Jotform for program ${programId}: form ${formId}`);
  }

  /** Accepts a numeric id or a full Jotform URL. */
  private normalizeJotformFormId(raw: string): string {
    const s = raw.trim();
    if (!s) return '';
    const fromUrl = s.match(/jotform\.com\/+(\d+)/i);
    if (fromUrl?.[1]) return fromUrl[1];
    return /^\d+$/.test(s) ? s : '';
  }

  /** Clone a Jotform template for webinar invitation/registration; webhook matches intakes to this program. */
  async createInvitationFormFromJotformTemplate(
    programId: string,
    templateFormId: string,
    titleHint?: string,
  ) {
    const program = await this.prisma.program.findUnique({ where: { id: programId } });
    if (!program) throw new BadRequestException('Program not found');

    const { formId, title: clonedTitle, url: jotformFormUrl } = await this.jotformService.cloneForm(templateFormId);
    await this.jotformService.addWebhook(formId);
    await this.prisma.program.update({
      where: { id: programId },
      data: { jotformIntakeFormUrl: jotformFormUrl },
    });
    this.logger.log(
      `Invitation Jotform for program ${programId}: form ${formId} (${titleHint ?? clonedTitle})`,
    );
    return { formId, jotformFormUrl };
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

    const existing = await this.prisma.surveyResponse.findUnique({
      where: {
        userId_surveyId: { userId, surveyId },
      },
    });

    if (existing) {
      const response = await this.prisma.surveyResponse.update({
        where: { id: existing.id },
        data: {
          answers: dto.answers as object,
          score: dto.score,
          submittedAt: new Date(),
        },
      });
      await this.formJotformProgress.clear(userId, FormJotformScope.SURVEY, surveyId).catch(() => {});
      this.logger.log(`Survey ${surveyId} re-submitted by user ${userId} (native); updated submittedAt`);
      return {
        id: response.id,
        submittedAt: response.submittedAt.toISOString(),
      };
    }

    const response = await this.prisma.surveyResponse.create({
      data: {
        userId,
        surveyId,
        answers: dto.answers as object,
        score: dto.score,
        submittedAt: new Date(),
      },
    });

    await this.formJotformProgress.clear(userId, FormJotformScope.SURVEY, surveyId).catch(() => {});

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, firstName: true, lastName: true, specialty: true, institution: true, city: true, state: true, zipCode: true },
    });
    if (user) {
      this.hubspot.createOrUpdateContact({
        email: user.email,
        firstname: user.firstName,
        lastname: user.lastName,
        jobtitle: user.specialty ?? undefined,
        company: user.institution ?? undefined,
        city: user.city ?? undefined,
        state: user.state ?? undefined,
        zip: user.zipCode ?? undefined,
      }).catch(() => {});
    }

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
