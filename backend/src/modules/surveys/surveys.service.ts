import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { ConfigService } from '@nestjs/config';
import {
  UserRole,
  SurveyType,
  ProgramRegistrationStatus,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { QueueService } from '../../queue/queue.service';
import { HubSpotService } from '../hubspot/hubspot.service';
import { JotformService } from '../jotform/jotform.service';
import { ProgramRegistrationsService } from '../programs/program-registrations.service';
import {
  defaultPostEventFeedbackQuestions,
  defaultWebinarIntakeQuestions,
} from './native-survey-templates';
import { extractJotformFormIdFromUrl } from '../../utils/jotform-form-id';
import {
  buildSurveyResponsesCsv,
  surveyResponsesCsvFilename,
} from '../../utils/survey-responses-csv';
import {
  buildSurveyResponseAnalytics,
  type SurveyResponseAnalytics,
  type SurveySegmentDimension,
} from '../../utils/survey-analytics';
import { FormJotformProgressService } from '../programs/form-jotform-progress.service';
import { FormJotformScope } from '../programs/form-jotform-scope';
import {
  assertNoIdentityFieldsInSurveyAnswers,
  stripIdentityFieldsFromSurveyAnswers,
} from '../../utils/survey-answer-sanitizer';
import { SubmitSurveyResponseDto } from './dto/submit-survey-response.dto';
import {
  findUnsafeAnsweredQuestionChanges,
  validateNativeSurveySchema,
} from '../../utils/survey-schema';

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
    private programRegistrations: ProgramRegistrationsService,
  ) {}

  /**
   * List surveys. Admins see all in `active`. Learners see FEEDBACK post-event surveys only
   * (intake/registration forms are excluded), split into active and completed.
   */
  async getAllForUser(
    userId: string,
    role: UserRole,
  ): Promise<{
    active: Array<{
      id: string;
      programId: string;
      title: string;
      description: string | null;
      type: string;
      required: boolean;
      isCustomized: boolean;
      responseCount?: number;
      jotformFormId: string | null;
      jotformFormUrl: string | null;
      createdAt: string;
      updatedAt: string;
      completedAt?: string;
      program: {
        id: string;
        title: string;
        sponsorName: string | null;
        honorariumAmount: number | null;
        creditAmount: number;
        zoomSessionType: string;
        startDate: Date | null;
      };
    }>;
    completed: Array<{
      id: string;
      programId: string;
      title: string;
      description: string | null;
      type: string;
      required: boolean;
      isCustomized: boolean;
      responseCount?: number;
      jotformFormId: string | null;
      jotformFormUrl: string | null;
      createdAt: string;
      updatedAt: string;
      completedAt?: string;
      program: {
        id: string;
        title: string;
        sponsorName: string | null;
        honorariumAmount: number | null;
        creditAmount: number;
        zoomSessionType: string;
        startDate: Date | null;
      };
    }>;
  }> {
    const surveys = await this.prisma.survey.findMany({
      // INNER JOIN semantics: drop orphan Survey rows whose programId has no Program
      // (DMS / manual deletes can leave broken FKs; required include would throw).
      where: {
        program: { id: { not: '' } },
      },
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
            duration: true,
            zoomSessionEndedAt: true,
          },
        },
        _count: { select: { responses: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    const mapped = surveys.map((s) => ({
      id: s.id,
      programId: s.programId,
      title: s.title,
      description: s.description,
      type: s.type,
      required: s.required,
      isCustomized: s.isCustomized,
      ...(role === UserRole.ADMIN ? { responseCount: s._count.responses } : {}),
      jotformFormId: s.jotformFormId,
      jotformFormUrl: s.jotformFormId
        ? `https://communityhealthmedia.jotform.com/${s.jotformFormId}`
        : null,
      createdAt: s.createdAt.toISOString(),
      updatedAt: s.updatedAt.toISOString(),
      program: s.program,
    }));
    if (role === UserRole.ADMIN) {
      return { active: mapped, completed: [] };
    }

    const active: typeof mapped = [];
    const completed: Array<(typeof mapped)[0] & { completedAt: string }> = [];

    for (const s of mapped) {
      if (s.type !== SurveyType.FEEDBACK || !s.programId) {
        continue;
      }

      const [enrollment, reg] = await Promise.all([
        this.prisma.programEnrollment.findUnique({
          where: { userId_programId: { userId, programId: s.programId } },
          select: { id: true },
        }),
        this.prisma.programRegistration.findUnique({
          where: { userId_programId: { userId, programId: s.programId } },
          select: {
            status: true,
            postEventSurveyAcknowledgedAt: true,
          },
        }),
      ]);

      if (
        !enrollment &&
        (!reg || reg.status !== ProgramRegistrationStatus.APPROVED)
      ) {
        continue;
      }

      const existing = await this.prisma.surveyResponse.findUnique({
        where: { userId_surveyId: { userId, surveyId: s.id } },
        select: { id: true, submittedAt: true },
      });

      const isCompleted = !!existing || !!reg?.postEventSurveyAcknowledgedAt;

      if (isCompleted) {
        const completedAt =
          existing?.submittedAt.toISOString() ??
          reg?.postEventSurveyAcknowledgedAt?.toISOString() ??
          s.updatedAt;
        completed.push({ ...s, completedAt });
        continue;
      }

      const ok =
        await this.programRegistrations.canUserAccessPostEventFeedbackSurvey(
          userId,
          s.programId,
        );
      if (ok) {
        active.push(s);
      }
    }

    return { active, completed };
  }

  /**
   * Get survey by ID. Admins: always. Learners: FEEDBACK is forbidden until attendance allows access.
   */
  async getByIdForUser(id: string, userId: string, role: UserRole) {
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
            duration: true,
            zoomSessionEndedAt: true,
          },
        },
        _count: { select: { responses: true } },
      },
    });
    if (!survey) {
      throw new NotFoundException('Survey not found');
    }
    if (!survey.program) {
      throw new NotFoundException('Survey program no longer exists');
    }
    if (role !== UserRole.ADMIN) {
      await this.assertUserCanAccessFeedbackSurvey(
        survey.type,
        survey.programId,
        userId,
      );
    }
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
      isCustomized: survey.isCustomized,
      jotformFormId: survey.jotformFormId,
      jotformFormUrl,
      createdAt: survey.createdAt.toISOString(),
      updatedAt: survey.updatedAt.toISOString(),
      ...(role === UserRole.ADMIN
        ? { responseCount: survey._count.responses }
        : {}),
      program: survey.program,
    };
  }

  private async assertUserCanAccessFeedbackSurvey(
    type: string,
    programId: string,
    userId: string,
  ): Promise<void> {
    if (type !== 'FEEDBACK' || !programId) {
      return;
    }
    const ok =
      await this.programRegistrations.canUserAccessPostEventFeedbackSurvey(
        userId,
        programId,
      );
    if (!ok) {
      throw new ForbiddenException(
        'This post-event survey is not available until your attendance is verified (and the session window has passed, when applicable).',
      );
    }
  }

  /**
   * Call before Jotform resume / my-response for a learner; admins bypass.
   */
  async ensureUserCanAccessSurvey(
    surveyId: string,
    userId: string,
    role: UserRole,
  ): Promise<void> {
    if (role === UserRole.ADMIN) {
      return;
    }
    const survey = await this.prisma.survey.findUnique({
      where: { id: surveyId },
      select: { type: true, programId: true },
    });
    if (!survey) {
      throw new NotFoundException('Survey not found');
    }
    await this.assertUserCanAccessFeedbackSurvey(
      survey.type,
      survey.programId,
      userId,
    );
  }

  /**
   * Whether the user already has a stored response (native submit or Jotform webhook).
   */
  async getMyResponseStatus(
    surveyId: string,
    userId: string,
    role: UserRole,
  ): Promise<{
    submitted: boolean;
    responseId?: string;
    submissionId?: string;
    submittedAt?: string;
  }> {
    await this.ensureUserCanAccessSurvey(surveyId, userId, role);

    const row = await this.prisma.surveyResponse.findUnique({
      where: { userId_surveyId: { userId, surveyId } },
      select: { id: true, submittedAt: true, submissionId: true },
    });
    if (!row) {
      return { submitted: false };
    }
    return {
      submitted: true,
      responseId: row.id,
      submissionId: row.submissionId ?? undefined,
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
    questions: Record<string, unknown>[] | Record<string, unknown>;
    type?: 'PRE_TEST' | 'POST_TEST' | 'FEEDBACK' | 'INTAKE';
    required?: boolean;
    jotformFormId?: string;
  }) {
    const program = await this.prisma.program.findUnique({
      where: { id: dto.programId },
    });
    if (!program) {
      throw new BadRequestException('Program not found');
    }

    let questions: object = dto.questions as object;
    const jotformFormId = dto.jotformFormId?.trim() || null;
    if (
      !jotformFormId &&
      dto.questions &&
      typeof dto.questions === 'object' &&
      !Array.isArray(dto.questions) &&
      Array.isArray((dto.questions as { sections?: unknown }).sections)
    ) {
      try {
        questions = validateNativeSurveySchema(
          dto.questions,
        ) as unknown as object;
      } catch (error) {
        throw new BadRequestException(
          error instanceof Error
            ? error.message
            : 'Invalid native survey schema',
        );
      }
    }

    const survey = await this.prisma.survey.create({
      data: {
        programId: dto.programId,
        title: dto.title,
        description: dto.description,
        questions,
        type: dto.type ?? 'POST_TEST',
        required: dto.required ?? true,
        jotformFormId,
        isCustomized: true,
      },
    });
    this.logger.log(`Survey created: ${survey.id} - ${survey.title}`);
    return survey;
  }

  /** Update an admin survey and mark it customized. */
  async updateSurvey(
    id: string,
    dto: {
      title?: string;
      description?: string;
      questions?: Record<string, unknown>;
      required?: boolean;
      jotformFormId?: string;
    },
  ) {
    const survey = await this.prisma.survey.findUnique({
      where: { id },
      include: { _count: { select: { responses: true } } },
    });
    if (!survey) throw new NotFoundException('Survey not found');

    let questions: Record<string, unknown> | undefined;
    if (dto.questions !== undefined) {
      if (dto.jotformFormId?.trim()) {
        throw new BadRequestException(
          'A survey cannot use native questions and a Jotform form at the same time.',
        );
      }
      try {
        questions = validateNativeSurveySchema(
          dto.questions,
        ) as unknown as Record<string, unknown>;
      } catch (error) {
        throw new BadRequestException(
          error instanceof Error
            ? error.message
            : 'Invalid native survey schema',
        );
      }

      if (survey._count.responses > 0) {
        const unsafe = findUnsafeAnsweredQuestionChanges(
          survey.questions,
          questions,
        );
        if (unsafe.length > 0) {
          throw new BadRequestException(
            `This survey has ${survey._count.responses} response(s). Existing question mappings cannot be changed: ${unsafe.join(
              '; ',
            )}. You may add new questions with new IDs.`,
          );
        }
      }
    }

    const title = dto.title?.trim();
    if (dto.title !== undefined && !title) {
      throw new BadRequestException('Survey title is required');
    }

    const updated = await this.prisma.survey.update({
      where: { id },
      data: {
        ...(title !== undefined && { title }),
        ...(dto.description !== undefined && {
          description: dto.description.trim() || null,
        }),
        ...(questions !== undefined && {
          questions: questions as object,
          jotformFormId: null,
        }),
        ...(dto.required !== undefined && { required: dto.required }),
        ...(dto.jotformFormId !== undefined && {
          jotformFormId: dto.jotformFormId?.trim() || null,
        }),
        isCustomized: true,
      },
    });
    if (
      survey.type === 'FEEDBACK' &&
      (dto.jotformFormId !== undefined || questions !== undefined)
    ) {
      const fid =
        questions !== undefined ? undefined : dto.jotformFormId?.trim();
      await this.prisma.program.update({
        where: { id: survey.programId },
        data: {
          jotformSurveyUrl: fid
            ? `https://communityhealthmedia.jotform.com/${fid}`
            : null,
        },
      });
    }
    this.logger.log(`Survey ${id} updated and marked customized`);
    return updated;
  }

  /**
   * Delete survey (admin), but never cascade-delete collected responses.
   */
  async deleteSurvey(id: string) {
    const survey = await this.prisma.survey.findUnique({
      where: { id },
      include: { _count: { select: { responses: true } } },
    });
    if (!survey) throw new NotFoundException('Survey not found');
    if (survey._count.responses > 0) {
      throw new BadRequestException(
        `Survey cannot be deleted because it has ${survey._count.responses} response(s).`,
      );
    }

    await this.prisma.survey.delete({ where: { id } });
    this.logger.log(`Survey deleted: ${id} - ${survey.title}`);
    return { deleted: true, id };
  }

  /** Admin: all submitted responses for a survey with learner identity. */
  async listResponsesForAdmin(surveyId: string) {
    const survey = await this.prisma.survey.findUnique({
      where: { id: surveyId },
      select: {
        id: true,
        title: true,
        type: true,
        questions: true,
        programId: true,
        program: { select: { id: true, title: true } },
      },
    });
    if (!survey) throw new NotFoundException('Survey not found');

    const responses = await this.prisma.surveyResponse.findMany({
      where: { surveyId },
      orderBy: { submittedAt: 'desc' },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            specialty: true,
          },
        },
      },
    });

    const userIds = responses.map((r) => r.userId);
    const registrations =
      survey.programId && userIds.length > 0
        ? await this.prisma.programRegistration.findMany({
            where: {
              programId: survey.programId,
              userId: { in: userIds },
            },
            select: {
              userId: true,
              status: true,
              postEventAttendanceStatus: true,
            },
          })
        : [];
    const regByUser = new Map(registrations.map((r) => [r.userId, r]));

    return {
      survey: {
        id: survey.id,
        title: survey.title,
        type: survey.type,
        questions: survey.questions,
        program: survey.program,
      },
      responses: responses.map((r) => ({
        id: r.id,
        submissionId: r.submissionId,
        submittedAt: r.submittedAt.toISOString(),
        score: r.score,
        answers: r.answers,
        user: r.user,
        registration: regByUser.get(r.userId) ?? null,
      })),
    };
  }

  /**
   * Admin: chart-ready analytics for a survey's responses.
   *
   * Reuses {@link listResponsesForAdmin} for the response/identity/registration
   * data, then delegates all aggregation to the pure `buildSurveyResponseAnalytics`
   * util. Completion rate is computed against APPROVED program registrations for
   * post-event surveys (FEEDBACK/PRE_TEST/POST_TEST); INTAKE and program-less
   * surveys report a null completion rate.
   *
   * Free-text samples are omitted by default (counts only). Pass
   * `includeTextSamples: true` to emit redacted samples for author-declared
   * text questions. Pass `segmentBy` to also emit a per-segment breakdown by
   * respondent specialty, registration status, or attendance status.
   */
  async getResponseAnalyticsForAdmin(
    surveyId: string,
    opts: {
      includeTextSamples?: boolean;
      segmentBy?: SurveySegmentDimension | null;
    } = {},
  ): Promise<{
    survey: {
      id: string;
      title: string;
      type: SurveyType;
      program: { id: string; title: string } | null;
    };
    analytics: SurveyResponseAnalytics;
  }> {
    const { survey, responses } = await this.listResponsesForAdmin(surveyId);

    const programId = survey.program?.id;

    const eligibleCount =
      programId && survey.type !== SurveyType.INTAKE
        ? await this.prisma.programRegistration.count({
            where: { programId, status: ProgramRegistrationStatus.APPROVED },
          })
        : null;

    const analytics = buildSurveyResponseAnalytics({
      surveyType: survey.type,
      questionsSchema: survey.questions,
      eligibleCount,
      includeTextSamples: opts.includeTextSamples ?? false,
      segmentBy: opts.segmentBy ?? null,
      responses: responses.map((r) => ({
        submittedAt: r.submittedAt,
        userId: r.user?.id ?? null,
        score: r.score,
        answers: (r.answers ?? {}) as Record<string, unknown>,
        segment: {
          specialty: r.user?.specialty ?? null,
          status: r.registration?.status ?? null,
          attendance: r.registration?.postEventAttendanceStatus ?? null,
        },
      })),
    });

    return {
      survey: {
        id: survey.id,
        title: survey.title,
        type: survey.type,
        program: survey.program,
      },
      analytics,
    };
  }

  /** Admin: CSV export for registration (INTAKE) or post-event (FEEDBACK) responses. */
  async buildResponsesCsvForAdmin(surveyId: string): Promise<{
    filename: string;
    body: string;
  }> {
    const { survey, responses } = await this.listResponsesForAdmin(surveyId);
    const body = buildSurveyResponsesCsv({
      surveyTitle: survey.title,
      surveyType: survey.type,
      questionsSchema: survey.questions,
      responses: responses.map((r) => ({
        submittedAt: r.submittedAt,
        answers: (r.answers ?? {}) as Record<string, unknown>,
        user: r.user,
        registration: r.registration,
      })),
    });
    return {
      filename: surveyResponsesCsvFilename(
        survey.program?.title ?? '',
        survey.type,
      ),
      body,
    };
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

    const {
      formId,
      title: clonedTitle,
      url: clonedFormUrl,
    } = await this.jotformService.cloneForm(dto.templateFormId);
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

    this.logger.log(
      `Survey created from Jotform template: ${survey.id} (form ${formId})`,
    );
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
    const inv = this.configService
      .get<string>('jotform.invitationTemplateFormId')
      ?.trim();
    const postTemplate = this.configService
      .get<string>('jotform.postEventTemplateFormId')
      ?.trim();
    const sharedPost = this.configService
      .get<string>('jotform.postEventSharedFormId')
      ?.trim();
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
    const inv = this.configService
      .get<string>('jotform.invitationTemplateFormId')
      ?.trim();
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
   * Legacy: link an existing Jotform as the program FEEDBACK survey without
   * replacing the Survey row. Refuses conversion once responses exist.
   */
  async applyManualPostEventJotform(
    programId: string,
    programTitle: string,
    formIdOrUrl: string,
  ) {
    const program = await this.prisma.program.findUnique({
      where: { id: programId },
    });
    if (!program) throw new BadRequestException('Program not found');

    const trimmed = formIdOrUrl.trim();
    const formId =
      this.normalizeJotformFormId(trimmed) ||
      extractJotformFormIdFromUrl(trimmed) ||
      '';
    if (!formId) {
      throw new BadRequestException(
        'Enter a valid Jotform form ID or form URL for the post-event survey (e.g. 123456789012345).',
      );
    }

    const jotformFormUrl = `https://communityhealthmedia.jotform.com/${formId}`;

    const existing = await this.prisma.survey.findFirst({
      where: { programId, type: 'FEEDBACK' },
      include: { _count: { select: { responses: true } } },
      orderBy: { createdAt: 'asc' },
    });
    if (existing?._count.responses) {
      throw new BadRequestException(
        'The post-event survey already has responses and cannot be converted to Jotform.',
      );
    }

    if (existing) {
      await this.prisma.survey.update({
        where: { id: existing.id },
        data: {
          jotformFormId: formId,
          questions: { source: 'jotform', formId, manualPostEvent: true },
          isCustomized: true,
        },
      });
    } else {
      await this.prisma.survey.create({
        data: {
          programId,
          title: `${programTitle} - Post Event Survey`,
          jotformFormId: formId,
          questions: { source: 'jotform', formId, manualPostEvent: true },
          type: 'FEEDBACK',
          required: true,
          isCustomized: true,
        },
      });
    }

    await this.prisma.program.update({
      where: { id: programId },
      data: { jotformSurveyUrl: jotformFormUrl },
    });

    this.logger.log(
      `Manual post-event Jotform for program ${programId}: form ${formId}`,
    );
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
    const inv = this.configService
      .get<string>('jotform.invitationTemplateFormId')!
      .trim();
    await this.createInvitationFormFromJotformTemplate(
      programId,
      inv,
      `${programTitle} - Invitation`,
    );
    await this.applyManualPostEventJotform(
      programId,
      programTitle,
      postEventFormIdOrUrl,
    );
  }

  /**
   * Create native INTAKE + FEEDBACK surveys for a new or imported webinar.
   */
  async attachSurveysForNewWebinar(
    programId: string,
    programTitle: string,
  ): Promise<{ intakeSurveyId: string; feedbackSurveyId: string }> {
    return this.ensureNativeSurveyPairForProgram(programId, programTitle);
  }

  /**
   * When true, legacy Jotform clone paths are used instead of native surveys (platform rollback only).
   */
  useLegacyJotformForms(): boolean {
    return (
      this.configService.get<boolean>('surveys.useLegacyJotformForms') === true
    );
  }

  /** @deprecated Prefer attachSurveysForNewWebinar; native is default unless legacy flag set. */
  useNativeForms(): boolean {
    return !this.useLegacyJotformForms();
  }

  /**
   * Ensure native INTAKE + FEEDBACK rows exist. Existing rows are returned
   * unchanged (including customized/Jotform rows); only missing types are created.
   */
  async ensureNativeSurveyPairForProgram(
    programId: string,
    programTitle: string,
  ): Promise<{ intakeSurveyId: string; feedbackSurveyId: string }> {
    const program = await this.prisma.program.findUnique({
      where: { id: programId },
    });
    if (!program) throw new BadRequestException('Program not found');

    const existing = await this.prisma.survey.findMany({
      where: { programId, type: { in: ['INTAKE', 'FEEDBACK'] } },
      orderBy: { createdAt: 'asc' },
    });
    let intake = existing.find((survey) => survey.type === 'INTAKE');
    let feedback = existing.find((survey) => survey.type === 'FEEDBACK');
    const createIntake = !intake;
    const createFeedback = !feedback;

    if (!intake) {
      intake = await this.prisma.survey.create({
        data: {
          programId,
          title: `${programTitle} - Registration`,
          description: 'Webinar registration intake',
          questions: defaultWebinarIntakeQuestions() as object,
          type: 'INTAKE',
          required: true,
          jotformFormId: null,
          isCustomized: false,
        },
      });
    }

    if (!feedback) {
      feedback = await this.prisma.survey.create({
        data: {
          programId,
          title: `${programTitle} - Post Event Survey`,
          description: 'Post-webinar feedback',
          questions: defaultPostEventFeedbackQuestions() as object,
          type: 'FEEDBACK',
          required: true,
          jotformFormId: null,
          isCustomized: false,
        },
      });
    }

    if (createIntake || createFeedback) {
      await this.prisma.program.update({
        where: { id: programId },
        data: {
          ...(createIntake && { jotformIntakeFormUrl: null }),
          ...(createFeedback && { jotformSurveyUrl: null }),
        },
      });
    }

    this.logger.log(
      `Ensured surveys for program ${programId}: intake=${intake.id} feedback=${feedback.id}`,
    );

    return { intakeSurveyId: intake.id, feedbackSurveyId: feedback.id };
  }

  /** Convert all published webinars to native surveys (dev / admin bulk). */
  async ensureNativeSurveysForPublishedWebinars(): Promise<
    Array<{
      programId: string;
      title: string;
      intakeSurveyId: string;
      feedbackSurveyId: string;
    }>
  > {
    const programs = await this.prisma.program.findMany({
      where: {
        zoomSessionType: 'WEBINAR',
        status: 'PUBLISHED',
      },
      select: { id: true, title: true },
      orderBy: { startDate: 'desc' },
    });

    const results: Array<{
      programId: string;
      title: string;
      intakeSurveyId: string;
      feedbackSurveyId: string;
    }> = [];

    for (const p of programs) {
      const pair = await this.ensureNativeSurveyPairForProgram(p.id, p.title);
      results.push({
        programId: p.id,
        title: p.title,
        ...pair,
      });
    }

    return results;
  }

  /**
   * Attach Jotform forms to a webhook-imported program without cloning.
   * Uses env-configured form IDs/URLs directly:
   *  - Intake: JOTFORM_WEBINAR_DEFAULT_INTAKE_URL (preferred) or constructed from invitationTemplateFormId
   *  - Post-event: postEventSharedFormId (preferred) or postEventTemplateFormId — no clone, just links the Survey record
   * Fails gracefully if none of the env vars are set.
   */
  async attachJotformFormsFromConfig(
    programId: string,
    programTitle: string,
  ): Promise<void> {
    if (!this.useLegacyJotformForms()) {
      await this.attachSurveysForNewWebinar(programId, programTitle);
      return;
    }

    const defaultIntakeUrl = this.configService
      .get<string>('jotform.webinarDefaultIntakeUrl')
      ?.trim();
    const invFormId = this.configService
      .get<string>('jotform.invitationTemplateFormId')
      ?.trim();
    const sharedPost = this.configService
      .get<string>('jotform.postEventSharedFormId')
      ?.trim();
    const postTemplate = this.configService
      .get<string>('jotform.postEventTemplateFormId')
      ?.trim();

    // 1. Intake / invitation form — no clone, just set the URL
    const intakeUrl =
      defaultIntakeUrl ||
      (invFormId
        ? `https://communityhealthmedia.jotform.com/${invFormId}`
        : null);
    if (intakeUrl) {
      await this.prisma.program.update({
        where: { id: programId },
        data: { jotformIntakeFormUrl: intakeUrl },
      });
      this.logger.log(
        `Webhook import: attached intake form for program ${programId}`,
      );
    }

    // 2. Post-event survey — use shared form (preferred) or template form ID directly, no clone
    const postFormId = sharedPost || postTemplate;
    if (postFormId) {
      await this.attachSharedPostEventSurvey(
        programId,
        programTitle,
        postFormId,
      );
    }

    if (!intakeUrl && !postFormId) {
      this.logger.warn(
        `Webhook import: no Jotform env vars configured for program ${programId} — skipping form attachment`,
      );
    }
  }

  /**
   * Clone invitation + post-event forms from env template IDs, add webhooks, set program intake URL + FEEDBACK survey.
   */
  async createWebinarJotformPairFromTemplates(
    programId: string,
    programTitle: string,
  ) {
    if (!this.useLegacyJotformForms()) {
      await this.attachSurveysForNewWebinar(programId, programTitle);
      return;
    }
    this.assertJotformConfiguredForWebinarClones();
    const inv = this.configService
      .get<string>('jotform.invitationTemplateFormId')!
      .trim();
    const sharedPost = this.configService
      .get<string>('jotform.postEventSharedFormId')
      ?.trim();
    await this.createInvitationFormFromJotformTemplate(
      programId,
      inv,
      `${programTitle} - Invitation`,
    );
    if (sharedPost) {
      await this.attachSharedPostEventSurvey(
        programId,
        programTitle,
        sharedPost,
      );
    } else {
      const post = this.configService
        .get<string>('jotform.postEventTemplateFormId')!
        .trim();
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
  async createWebinarPostEventOnlyFromTemplates(
    programId: string,
    programTitle: string,
  ) {
    if (!this.useLegacyJotformForms()) {
      await this.attachSurveysForNewWebinar(programId, programTitle);
      return;
    }
    const sharedPost = this.configService
      .get<string>('jotform.postEventSharedFormId')
      ?.trim();
    if (sharedPost) {
      await this.attachSharedPostEventSurvey(
        programId,
        programTitle,
        sharedPost,
      );
      return;
    }
    const postTemplate = this.configService
      .get<string>('jotform.postEventTemplateFormId')
      ?.trim();
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
  private async attachSharedPostEventSurvey(
    programId: string,
    programTitle: string,
    formIdRaw: string,
  ) {
    const program = await this.prisma.program.findUnique({
      where: { id: programId },
    });
    if (!program) throw new BadRequestException('Program not found');

    const formId = this.normalizeJotformFormId(formIdRaw);
    if (!formId) {
      throw new BadRequestException(
        'Invalid JOTFORM_WEBINAR_POST_EVENT_SHARED_FORM_ID',
      );
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
    this.logger.log(
      `Shared post-event Jotform for program ${programId}: form ${formId}`,
    );
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
    const program = await this.prisma.program.findUnique({
      where: { id: programId },
    });
    if (!program) throw new BadRequestException('Program not found');

    const {
      formId,
      title: clonedTitle,
      url: jotformFormUrl,
    } = await this.jotformService.cloneForm(templateFormId);
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
    role: UserRole,
    dto: SubmitSurveyResponseDto,
  ): Promise<{ id: string; submissionId?: string; submittedAt: string }> {
    await this.ensureUserCanAccessSurvey(surveyId, userId, role);
    assertNoIdentityFieldsInSurveyAnswers(dto.answers);
    const answers = stripIdentityFieldsFromSurveyAnswers(dto.answers);

    const survey = await this.prisma.survey.findUnique({
      where: { id: surveyId },
      include: { program: true },
    });

    if (!survey) {
      throw new NotFoundException('Survey not found');
    }
    if (!survey.program) {
      throw new NotFoundException('Survey program no longer exists');
    }

    const existing = await this.prisma.surveyResponse.findUnique({
      where: {
        userId_surveyId: { userId, surveyId },
      },
    });

    if (existing && survey.type === SurveyType.FEEDBACK) {
      return {
        id: existing.id,
        submissionId: existing.submissionId ?? undefined,
        submittedAt: existing.submittedAt.toISOString(),
      };
    }

    let response;
    if (existing) {
      response = await this.prisma.surveyResponse.update({
        where: { id: existing.id },
        data: {
          answers: answers as object,
          score: dto.score,
          submittedAt: new Date(),
          ...(!existing.submissionId ? { submissionId: randomUUID() } : {}),
        },
      });
      await this.formJotformProgress
        .clear(userId, FormJotformScope.SURVEY, surveyId)
        .catch(() => {});
      this.logger.log(
        `Survey ${surveyId} re-submitted by user ${userId} (native); updated submittedAt`,
      );
    } else {
      response = await this.prisma.surveyResponse.create({
        data: {
          userId,
          surveyId,
          answers: answers as object,
          score: dto.score,
          submittedAt: new Date(),
          submissionId: randomUUID(),
        },
      });

      await this.formJotformProgress
        .clear(userId, FormJotformScope.SURVEY, surveyId)
        .catch(() => {});

      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          email: true,
          firstName: true,
          lastName: true,
          specialty: true,
          institution: true,
          city: true,
          state: true,
          zipCode: true,
        },
      });
      if (user) {
        this.hubspot
          .createOrUpdateContact({
            email: user.email,
            firstname: user.firstName,
            lastname: user.lastName,
            jobtitle: user.specialty ?? undefined,
            company: user.institution ?? undefined,
            city: user.city ?? undefined,
            state: user.state ?? undefined,
            zip: user.zipCode ?? undefined,
          })
          .catch(() => {});
      }

      this.logger.log(`Survey ${surveyId} submitted by user ${userId}`);

      const surveyBonusAmount = this.configService.get<number>(
        'surveys.bonusAmountCents',
      );
      if (surveyBonusAmount && surveyBonusAmount > 0) {
        const queued = await this.queueService.processPayment(
          userId,
          surveyBonusAmount,
          'SURVEY_BONUS',
          survey.programId,
          `survey_bonus:${userId}:${surveyId}`,
        );
        if (!queued) {
          this.logger.warn(
            `SURVEY_BONUS queue not sent for user ${userId} survey ${surveyId} (queue unavailable)`,
          );
        }
        this.logger.log(
          `Queued SURVEY_BONUS payment for user ${userId}: $${surveyBonusAmount / 100}`,
        );
      }
    }

    if (survey.type === SurveyType.FEEDBACK) {
      const npiRaw = answers.npi ?? answers.npi_number;
      const npi =
        typeof npiRaw === 'string' && npiRaw.trim()
          ? npiRaw.trim().replace(/\D/g, '').slice(0, 10)
          : '';
      if (npi.length === 10) {
        await this.prisma.user
          .update({
            where: { id: userId },
            data: { npiNumber: npi },
          })
          .catch(() => {});
      }
      await this.prisma.programRegistration
        .updateMany({
          where: { userId, programId: survey.programId },
          data: { postEventSurveyAcknowledgedAt: new Date() },
        })
        .catch((err: unknown) => {
          this.logger.warn(
            `Could not sync post-event survey response to registration: ${String(err)}`,
          );
        });
    }

    if (survey.type === SurveyType.INTAKE) {
      const intakeSubmissionId = response.submissionId ?? response.id;
      const npiRaw = answers.npi ?? answers.npi_number;
      const npi =
        typeof npiRaw === 'string' && npiRaw.trim()
          ? npiRaw.trim().replace(/\D/g, '').slice(0, 10)
          : '';
      if (npi.length === 10) {
        await this.prisma.user
          .update({
            where: { id: userId },
            data: { npiNumber: npi },
          })
          .catch((err: unknown) => {
            this.logger.warn(
              `Could not sync NPI from intake survey for user ${userId}: ${String(err)}`,
            );
          });
      }
      await this.programRegistrations
        .recordWebinarIntakeSubmission(
          userId,
          survey.programId,
          intakeSubmissionId,
        )
        .catch((err: unknown) => {
          this.logger.warn(
            `Could not sync native intake survey to registration: ${String(err)}`,
          );
        });
    }

    return {
      id: response.id,
      submissionId: response.submissionId ?? undefined,
      submittedAt: response.submittedAt.toISOString(),
    };
  }
}
