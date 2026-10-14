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
  type SurveyResponse,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { QueueService } from '../../queue/queue.service';
import { OutboundSyncService } from '../outbound-sync/outbound-sync.service';
import { ProgramRegistrationsService } from '../programs/program-registrations.service';
import {
  defaultPostEventFeedbackQuestions,
  defaultWebinarIntakeQuestions,
} from './native-survey-templates';
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
  buildProfilePrefill,
  extractProfileUpdatesFromAnswers,
} from './profile-sync';
import {
  findUnsafeAnsweredQuestionChanges,
  nextNativeSchemaVersion,
  validateNativeSurveySchema,
  withNativeSchemaVersion,
} from '../../utils/survey-schema';
import { learnerHonorariumFlags } from '../../utils/learner-honorarium';

@Injectable()
export class SurveysService {
  private readonly logger = new Logger(SurveysService.name);

  constructor(
    private prisma: PrismaService,
    private queueService: QueueService,
    private configService: ConfigService,
    private outboundSync: OutboundSyncService,
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
        /** Present for admins; omitted for learners (use hasHonorarium). */
        honorariumAmount?: number | null;
        hasHonorarium?: boolean;
        creditAmount: number;
        zoomSessionType: string;
        startDate: Date | null;
        duration?: number | null;
        zoomSessionEndedAt?: Date | null;
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
        honorariumAmount?: number | null;
        hasHonorarium?: boolean;
        creditAmount: number;
        zoomSessionType: string;
        startDate: Date | null;
        duration?: number | null;
        zoomSessionEndedAt?: Date | null;
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
    const mapped = surveys.map((s) => {
      const program =
        role === UserRole.ADMIN
          ? s.program
          : s.program
            ? {
                id: s.program.id,
                title: s.program.title,
                sponsorName: s.program.sponsorName,
                creditAmount: s.program.creditAmount,
                zoomSessionType: s.program.zoomSessionType,
                startDate: s.program.startDate,
                duration: s.program.duration,
                zoomSessionEndedAt: s.program.zoomSessionEndedAt,
                ...learnerHonorariumFlags(s.program.honorariumAmount),
              }
            : s.program;
      return {
        id: s.id,
        programId: s.programId,
        title: s.title,
        description: s.description,
        type: s.type,
        required: s.required,
        isCustomized: s.isCustomized,
        schemaVersion: s.schemaVersion,
        ...(role === UserRole.ADMIN
          ? { responseCount: s._count.responses }
          : {}),
        jotformFormId: s.jotformFormId,
        jotformFormUrl: s.jotformFormId
          ? `https://communityhealthmedia.jotform.com/${s.jotformFormId}`
          : null,
        createdAt: s.createdAt.toISOString(),
        updatedAt: s.updatedAt.toISOString(),
        program,
      };
    });
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
      schemaVersion: survey.schemaVersion,
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
    let schemaVersion = 1;
    const jotformFormId = dto.jotformFormId?.trim() || null;
    if (
      !jotformFormId &&
      dto.questions &&
      typeof dto.questions === 'object' &&
      !Array.isArray(dto.questions) &&
      Array.isArray((dto.questions as { sections?: unknown }).sections)
    ) {
      try {
        const validated = validateNativeSurveySchema(dto.questions);
        schemaVersion =
          Number.isInteger(validated.version) && validated.version > 0
            ? validated.version
            : 1;
        questions = withNativeSchemaVersion(validated, schemaVersion) as object;
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
        schemaVersion,
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
      type?: 'INTAKE' | 'FEEDBACK' | 'PRE_TEST' | 'POST_TEST';
    },
  ) {
    const survey = await this.prisma.survey.findUnique({
      where: { id },
      include: { _count: { select: { responses: true } } },
    });
    if (!survey) throw new NotFoundException('Survey not found');

    // Responses are tied to the survey's purpose (registration vs post-event),
    // so the type is fixed once anyone has answered.
    const typeChange =
      dto.type !== undefined && dto.type !== survey.type ? dto.type : undefined;
    if (typeChange && survey._count.responses > 0) {
      throw new BadRequestException(
        `This survey has ${survey._count.responses} response(s); its type can no longer change.`,
      );
    }

    let questions: Record<string, unknown> | undefined;
    let schemaVersion: number | undefined;
    if (dto.questions !== undefined) {
      if (dto.jotformFormId?.trim()) {
        throw new BadRequestException(
          'A survey cannot use native questions and a Jotform form at the same time.',
        );
      }
      try {
        const validated = validateNativeSurveySchema(dto.questions);
        if (survey._count.responses > 0) {
          const unsafe = findUnsafeAnsweredQuestionChanges(
            survey.questions,
            validated,
          );
          if (unsafe.length > 0) {
            throw new BadRequestException(
              `This survey has ${survey._count.responses} response(s). Existing question mappings cannot be changed: ${unsafe.join(
                '; ',
              )}. You may add new questions with new IDs.`,
            );
          }
        }
        schemaVersion = nextNativeSchemaVersion(
          survey.schemaVersion,
          survey.questions,
        );
        questions = withNativeSchemaVersion(
          validated,
          schemaVersion,
        ) as unknown as Record<string, unknown>;
      } catch (error) {
        if (error instanceof BadRequestException) throw error;
        throw new BadRequestException(
          error instanceof Error
            ? error.message
            : 'Invalid native survey schema',
        );
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
          schemaVersion,
        }),
        ...(dto.required !== undefined && { required: dto.required }),
        ...(typeChange && { type: typeChange }),
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
    this.logger.log(
      `Survey ${id} updated and marked customized` +
        (typeChange ? ` (type ${survey.type} -> ${typeChange})` : '') +
        (schemaVersion != null ? ` (schemaVersion=${schemaVersion})` : ''),
    );
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

  /**
   * Admin: learner responses for a survey.
   * Pass `page`/`pageSize` for paginated UI lists.
   * Omit both to load all rows (CSV export / analytics).
   */
  async listResponsesForAdmin(
    surveyId: string,
    opts?: { page?: number; pageSize?: number },
  ) {
    const survey = await this.prisma.survey.findUnique({
      where: { id: surveyId },
      select: {
        id: true,
        title: true,
        type: true,
        questions: true,
        schemaVersion: true,
        programId: true,
        program: { select: { id: true, title: true } },
      },
    });
    if (!survey) throw new NotFoundException('Survey not found');

    const total = await this.prisma.surveyResponse.count({
      where: { surveyId },
    });

    const paginate = opts?.page != null || opts?.pageSize != null;
    const pageSize = paginate
      ? Math.min(Math.max(opts?.pageSize ?? 10, 1), 100)
      : Math.max(total, 1);
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const page = paginate
      ? Math.min(Math.max(opts?.page ?? 1, 1), totalPages)
      : 1;
    const skip = paginate ? (page - 1) * pageSize : 0;
    const take = paginate ? pageSize : undefined;

    const responses = await this.prisma.surveyResponse.findMany({
      where: { surveyId },
      orderBy: { submittedAt: 'desc' },
      ...(take != null ? { skip, take } : {}),
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
        schemaVersion: survey.schemaVersion,
        program: survey.program,
      },
      responses: responses.map((r) => ({
        id: r.id,
        submissionId: r.submissionId,
        submittedAt: r.submittedAt.toISOString(),
        score: r.score,
        schemaVersion: r.schemaVersion,
        answers: r.answers,
        user: r.user,
        registration: regByUser.get(r.userId) ?? null,
      })),
      pagination: {
        page,
        pageSize: paginate ? pageSize : total,
        total,
      },
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

  /** Compact catalog used to match Content Hub / HubSpot campaigns to CHT surveys. */
  async listSurveysForCampaignDashboard(): Promise<
    Array<{
      id: string;
      title: string;
      type: SurveyType;
      jotformFormId: string | null;
      programId: string;
      programTitle: string;
    }>
  > {
    const surveys = await this.prisma.survey.findMany({
      where: {
        type: { in: [SurveyType.FEEDBACK, SurveyType.INTAKE] },
      },
      select: {
        id: true,
        title: true,
        type: true,
        jotformFormId: true,
        programId: true,
        program: { select: { title: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return surveys.map((s) => ({
      id: s.id,
      title: s.title,
      type: s.type,
      jotformFormId: s.jotformFormId,
      programId: s.programId,
      programTitle: s.program.title,
    }));
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
        schemaVersion: r.schemaVersion,
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

  /** CPR-5: Jotform survey create/clone is removed; use native surveys. */
  private jotformCreateRemovedMessage(): string {
    return (
      'Creating or attaching Jotform surveys is no longer supported. ' +
      'Use native intake and feedback surveys (optionally clone questions from an existing survey template).'
    );
  }

  /**
   * @deprecated CPR-5 — always rejects. Historical Jotform export still uses JotformService separately.
   */
  async createSurveyFromJotformTemplate(_dto: {
    programId: string;
    templateFormId: string;
    title?: string;
    type?: 'PRE_TEST' | 'POST_TEST' | 'FEEDBACK';
  }): Promise<never> {
    throw new BadRequestException(this.jotformCreateRemovedMessage());
  }

  /**
   * @deprecated CPR-5 — always rejects. Cannot attach Jotform as FEEDBACK anymore.
   */
  async applyManualPostEventJotform(
    _programId: string,
    _programTitle: string,
    _formIdOrUrl: string,
  ): Promise<never> {
    throw new BadRequestException(this.jotformCreateRemovedMessage());
  }

  /**
   * @deprecated CPR-5 — attaches native surveys only (ignores Jotform form id).
   */
  async createWebinarInvitationAndManualPostSurvey(
    programId: string,
    programTitle: string,
    _postEventFormIdOrUrl: string,
  ) {
    return this.attachSurveysForNewWebinar(programId, programTitle);
  }

  /**
   * Create native INTAKE + FEEDBACK surveys for a new or imported webinar.
   * Optional source IDs clone questions from an existing survey (same type)
   * so admins can reuse a customized form on a future session.
   */
  async attachSurveysForNewWebinar(
    programId: string,
    programTitle: string,
    opts?: {
      intakeSurveySourceId?: string;
      feedbackSurveySourceId?: string;
    },
  ): Promise<{ intakeSurveyId: string; feedbackSurveyId: string }> {
    if (opts?.intakeSurveySourceId?.trim()) {
      await this.cloneSurveyOntoProgram(
        programId,
        opts.intakeSurveySourceId.trim(),
        { expectedType: 'INTAKE', programTitle },
      );
    }
    if (opts?.feedbackSurveySourceId?.trim()) {
      await this.cloneSurveyOntoProgram(
        programId,
        opts.feedbackSurveySourceId.trim(),
        { expectedType: 'FEEDBACK', programTitle },
      );
    }
    return this.ensureNativeSurveyPairForProgram(programId, programTitle);
  }

  /**
   * Surveys that can be reused as question templates on another program.
   * Customized rows sort first so Amanda's DB09 forms surface quickly.
   */
  async listReusableSurveyTemplates(type?: 'INTAKE' | 'FEEDBACK'): Promise<
    Array<{
      id: string;
      title: string;
      type: SurveyType;
      isCustomized: boolean;
      schemaVersion: number;
      updatedAt: string;
      responseCount: number;
      program: { id: string; title: string; startDate: string | null };
    }>
  > {
    const rows = await this.prisma.survey.findMany({
      where: {
        type: type ? type : { in: [SurveyType.INTAKE, SurveyType.FEEDBACK] },
        // Only native question schemas can be cloned safely.
        jotformFormId: null,
      },
      select: {
        id: true,
        title: true,
        type: true,
        isCustomized: true,
        schemaVersion: true,
        updatedAt: true,
        program: { select: { id: true, title: true, startDate: true } },
        _count: { select: { responses: true } },
      },
      orderBy: [{ isCustomized: 'desc' }, { updatedAt: 'desc' }],
      take: 200,
    });

    return rows.map((r) => ({
      id: r.id,
      title: r.title,
      type: r.type,
      isCustomized: r.isCustomized,
      schemaVersion: r.schemaVersion,
      updatedAt: r.updatedAt.toISOString(),
      responseCount: r._count.responses,
      program: {
        id: r.program.id,
        title: r.program.title,
        startDate: r.program.startDate?.toISOString() ?? null,
      },
    }));
  }

  /**
   * Copy questions from `sourceSurveyId` onto `programId` for the same type.
   * Creates a new row when missing; replaces an empty existing row (0 responses).
   * Refuses to overwrite a survey that already has responses.
   */
  async cloneSurveyOntoProgram(
    programId: string,
    sourceSurveyId: string,
    opts?: {
      expectedType?: 'INTAKE' | 'FEEDBACK';
      programTitle?: string;
    },
  ): Promise<{
    surveyId: string;
    type: SurveyType;
    created: boolean;
    replaced: boolean;
  }> {
    const program = await this.prisma.program.findUnique({
      where: { id: programId },
      select: { id: true, title: true },
    });
    if (!program) throw new NotFoundException('Program not found');

    const source = await this.prisma.survey.findUnique({
      where: { id: sourceSurveyId },
    });
    if (!source) throw new NotFoundException('Source survey not found');
    if (opts?.expectedType && source.type !== opts.expectedType) {
      throw new BadRequestException(
        `Source survey type is ${source.type}; expected ${opts.expectedType}.`,
      );
    }
    if (
      source.type !== SurveyType.INTAKE &&
      source.type !== SurveyType.FEEDBACK
    ) {
      throw new BadRequestException(
        'Only INTAKE or FEEDBACK surveys can be reused as templates.',
      );
    }
    if (source.programId === programId) {
      throw new BadRequestException(
        'Source survey is already linked to this program.',
      );
    }

    const questions = withNativeSchemaVersion(
      validateNativeSurveySchema(source.questions),
      source.schemaVersion || 1,
    );
    const titleSuffix =
      source.type === SurveyType.INTAKE ? 'Registration' : 'Post Event Survey';
    const titleBase =
      (opts?.programTitle ?? program.title).trim() || program.title;
    const nextTitle = `${titleBase} - ${titleSuffix}`;

    const existing = await this.prisma.survey.findFirst({
      where: { programId, type: source.type },
      orderBy: { createdAt: 'asc' },
    });

    if (existing) {
      const responseCount = await this.prisma.surveyResponse.count({
        where: { surveyId: existing.id },
      });
      if (responseCount > 0) {
        throw new BadRequestException(
          `Cannot replace the ${source.type} survey on this program: it already has ${responseCount} response(s).`,
        );
      }
      const updated = await this.prisma.survey.update({
        where: { id: existing.id },
        data: {
          title: nextTitle,
          description:
            source.description ??
            (source.type === SurveyType.INTAKE
              ? 'Webinar registration intake'
              : 'Post-webinar feedback'),
          questions: questions as object,
          schemaVersion: source.schemaVersion || 1,
          isCustomized: true,
          jotformFormId: null,
          jotformWebhookUrl: null,
          required: source.required,
        },
      });
      this.logger.log(
        `Cloned survey ${source.id} onto program ${programId} (replaced ${existing.id})`,
      );
      return {
        surveyId: updated.id,
        type: updated.type,
        created: false,
        replaced: true,
      };
    }

    const created = await this.prisma.survey.create({
      data: {
        programId,
        title: nextTitle,
        description:
          source.description ??
          (source.type === SurveyType.INTAKE
            ? 'Webinar registration intake'
            : 'Post-webinar feedback'),
        questions: questions as object,
        type: source.type,
        required: source.required,
        jotformFormId: null,
        jotformWebhookUrl: null,
        isCustomized: true,
        schemaVersion: source.schemaVersion || 1,
      },
    });
    await this.prisma.program.update({
      where: { id: programId },
      data:
        source.type === SurveyType.INTAKE
          ? { jotformIntakeFormUrl: null }
          : { jotformSurveyUrl: null },
    });
    this.logger.log(
      `Cloned survey ${source.id} onto program ${programId} (created ${created.id})`,
    );
    return {
      surveyId: created.id,
      type: created.type,
      created: true,
      replaced: false,
    };
  }

  /**
   * CPR-5: legacy Jotform create/attach is removed. Always false.
   * @deprecated Kept for call-site compatibility; do not re-enable.
   */
  useLegacyJotformForms(): boolean {
    return false;
  }

  /** Native surveys are the only create path (CPR-5). */
  useNativeForms(): boolean {
    return true;
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
      const intakeQuestions = withNativeSchemaVersion(
        validateNativeSurveySchema(defaultWebinarIntakeQuestions()),
        1,
      );
      intake = await this.prisma.survey.create({
        data: {
          programId,
          title: `${programTitle} - Registration`,
          description: 'Webinar registration intake',
          questions: intakeQuestions as object,
          type: 'INTAKE',
          required: true,
          jotformFormId: null,
          isCustomized: false,
          schemaVersion: 1,
        },
      });
    }

    if (!feedback) {
      const feedbackQuestions = withNativeSchemaVersion(
        validateNativeSurveySchema(defaultPostEventFeedbackQuestions()),
        1,
      );
      feedback = await this.prisma.survey.create({
        data: {
          programId,
          title: `${programTitle} - Post Event Survey`,
          description: 'Post-webinar feedback',
          questions: feedbackQuestions as object,
          type: 'FEEDBACK',
          required: true,
          jotformFormId: null,
          isCustomized: false,
          schemaVersion: 1,
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
   * @deprecated CPR-5 name kept for callers — always attaches native surveys.
   */
  async attachJotformFormsFromConfig(
    programId: string,
    programTitle: string,
  ): Promise<void> {
    await this.attachSurveysForNewWebinar(programId, programTitle);
  }

  /**
   * @deprecated CPR-5 — native surveys only.
   */
  async createWebinarJotformPairFromTemplates(
    programId: string,
    programTitle: string,
  ) {
    return this.attachSurveysForNewWebinar(programId, programTitle);
  }

  /**
   * @deprecated CPR-5 — native surveys only.
   */
  async createWebinarPostEventOnlyFromTemplates(
    programId: string,
    programTitle: string,
  ) {
    return this.attachSurveysForNewWebinar(programId, programTitle);
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

    let response: SurveyResponse;
    if (existing) {
      response = await this.prisma.surveyResponse.update({
        where: { id: existing.id },
        data: {
          answers: answers as object,
          score: dto.score,
          schemaVersion: survey.schemaVersion,
          submittedAt: new Date(),
          ...(!existing.submissionId ? { submissionId: randomUUID() } : {}),
        },
      });
      await this.formJotformProgress
        .clear(userId, FormJotformScope.SURVEY, surveyId)
        .catch(() => {});
      await this.writeProfileFromSurveyAnswers(
        userId,
        surveyId,
        survey.questions,
        answers,
      );
      this.logger.log(
        `Survey ${surveyId} re-submitted by user ${userId} (native); updated submittedAt schemaVersion=${survey.schemaVersion}`,
      );
    } else {
      response = await this.prisma.surveyResponse.create({
        data: {
          userId,
          surveyId,
          answers: answers as object,
          score: dto.score,
          schemaVersion: survey.schemaVersion,
          submittedAt: new Date(),
          submissionId: randomUUID(),
        },
      });

      await this.formJotformProgress
        .clear(userId, FormJotformScope.SURVEY, surveyId)
        .catch(() => {});

      await this.writeProfileFromSurveyAnswers(
        userId,
        surveyId,
        survey.questions,
        answers,
      );

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
          npiNumber: true,
        },
      });
      if (user) {
        this.outboundSync
          .syncUser({
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            npiNumber: user.npiNumber,
            specialty: user.specialty,
            institution: user.institution,
            city: user.city,
            state: user.state,
            zipCode: user.zipCode,
          })
          .catch((err) =>
            this.logger.error('[Surveys] outbound-sync error:', err),
          );
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
      // Persist NPI from intake answers. Mark registration SURVEY_SUBMITTED —
      // the wizard's explicit "Submit registration" (or Jotform path) moves to
      // PENDING/APPROVED. Do not auto-approve here.
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
        .markIntakeSurveySubmitted(userId, survey.programId, intakeSubmissionId)
        .catch((err: unknown) => {
          this.logger.warn(
            `Could not mark intake survey submitted on registration: ${String(err)}`,
          );
        });
    }

    return {
      id: response.id,
      submissionId: response.submissionId ?? undefined,
      submittedAt: response.submittedAt.toISOString(),
    };
  }

  /**
   * SCRUM-186: mirror survey answers back to the User profile for any
   * question that opts in via `syncToProfile`. Fires on both first submit
   * and re-submit. Never fails the survey submit itself.
   */
  private async writeProfileFromSurveyAnswers(
    userId: string,
    surveyId: string,
    questions: unknown,
    answers: Record<string, unknown>,
  ): Promise<void> {
    try {
      const profileUpdates = extractProfileUpdatesFromAnswers(
        questions,
        answers,
      );
      if (Object.keys(profileUpdates).length === 0) return;
      await this.prisma.user.update({
        where: { id: userId },
        data: profileUpdates,
      });
      this.logger.log(
        `Survey ${surveyId}: wrote back ${Object.keys(profileUpdates).length} profile field(s) for user ${userId}`,
      );
    } catch (err) {
      this.logger.error(
        `[Surveys] profile write-back failed for user ${userId} survey ${surveyId}: ${(err as Error).message}`,
      );
    }
  }

  /**
   * SCRUM-186: return the pre-fill map for a survey. Reads the current
   * User profile and returns `{ [questionId]: currentValue }` for each
   * question with a `syncToProfile` mapping whose target field is set.
   */
  async getProfilePrefill(
    surveyId: string,
    userId: string,
    role: UserRole,
  ): Promise<Record<string, string>> {
    await this.ensureUserCanAccessSurvey(surveyId, userId, role);
    const survey = await this.prisma.survey.findUnique({
      where: { id: surveyId },
      select: { questions: true },
    });
    if (!survey) throw new NotFoundException('Survey not found');
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        firstName: true,
        lastName: true,
        specialty: true,
        npiNumber: true,
        institution: true,
        city: true,
        state: true,
        zipCode: true,
      },
    });
    if (!user) return {};
    return buildProfilePrefill(survey.questions, user);
  }
}
