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
import { isPlatformAdmin } from '../../common/roles';
import { PrismaService } from '../../prisma/prisma.service';
import { QueueService } from '../../queue/queue.service';
import { OutboundSyncService } from '../outbound-sync/outbound-sync.service';
import { ProgramRegistrationsService } from '../programs/program-registrations.service';
import {
  defaultPostEventFeedbackQuestions,
  defaultWebinarIntakeQuestions,
  HCP_BETA_TESTING_TEMPLATE_ID,
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
  diffSuggestedProfileUpdates,
  extractProfileUpdatesFromAnswers,
  type SyncableUserProfile,
} from './profile-sync';
import {
  findUnsafeAnsweredQuestionChanges,
  listNativeSurveyQuestions,
  nextNativeSchemaVersion,
  validateNativeSurveySchema,
  withNativeSchemaVersion,
} from '../../utils/survey-schema';
import { learnerHonorariumFlags } from '../../utils/learner-honorarium';

/** SCRUM-291 dashboard: flag FEEDBACK surveys under this completion %. */
const WORKSPACE_LOW_COMPLETION_RATE = 40;
/** Cap beta analytics fan-out so the workspace stats call stays cheap. */
const WORKSPACE_BETA_SURVEY_CAP = 40;

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
      /** Admin-only: completed/eligible % for non-INTAKE program surveys. */
      completionRate?: number | null;
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
      completionRate?: number | null;
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
        _count: {
          select: { responses: { where: { isDraft: false } } },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const eligibleByProgram = new Map<string, number>();
    if (isPlatformAdmin(role)) {
      const programIds = [
        ...new Set(
          surveys
            .filter((s) => s.type !== SurveyType.INTAKE && s.programId)
            .map((s) => s.programId),
        ),
      ];
      if (programIds.length > 0) {
        const rows = await this.prisma.programRegistration.groupBy({
          by: ['programId'],
          where: {
            programId: { in: programIds },
            status: ProgramRegistrationStatus.APPROVED,
          },
          _count: { _all: true },
        });
        for (const row of rows) {
          eligibleByProgram.set(row.programId, row._count._all);
        }
      }
    }

    const mapped = surveys.map((s) => {
      const program =
        isPlatformAdmin(role)
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
      const responseCount = s._count.responses;
      let completionRate: number | null | undefined;
      if (isPlatformAdmin(role)) {
        if (s.type === SurveyType.INTAKE || !s.programId) {
          completionRate = null;
        } else {
          const eligible = eligibleByProgram.get(s.programId) ?? 0;
          completionRate =
            eligible > 0
              ? Math.round((responseCount / eligible) * 1000) / 10
              : null;
        }
      }
      return {
        id: s.id,
        programId: s.programId,
        title: s.title,
        description: s.description,
        type: s.type,
        required: s.required,
        isCustomized: s.isCustomized,
        schemaVersion: s.schemaVersion,
        ...(isPlatformAdmin(role)
          ? { responseCount, completionRate }
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
    if (isPlatformAdmin(role)) {
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
        select: { id: true, submittedAt: true, isDraft: true },
      });

      const isCompleted =
        (!!existing && !existing.isDraft) ||
        !!reg?.postEventSurveyAcknowledgedAt;

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
        _count: {
          select: { responses: { where: { isDraft: false } } },
        },
      },
    });
    if (!survey) {
      throw new NotFoundException('Survey not found');
    }
    if (!survey.program) {
      throw new NotFoundException('Survey program no longer exists');
    }
    if (!isPlatformAdmin(role)) {
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
      ...(isPlatformAdmin(role)
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
    if (isPlatformAdmin(role)) {
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
    draft?: boolean;
    responseId?: string;
    submissionId?: string;
    submittedAt?: string;
    answers?: Record<string, unknown>;
  }> {
    await this.ensureUserCanAccessSurvey(surveyId, userId, role);

    const row = await this.prisma.surveyResponse.findUnique({
      where: { userId_surveyId: { userId, surveyId } },
      select: {
        id: true,
        submittedAt: true,
        submissionId: true,
        isDraft: true,
        answers: true,
      },
    });
    if (!row) {
      return { submitted: false };
    }
    const answers =
      row.answers && typeof row.answers === 'object' && !Array.isArray(row.answers)
        ? (row.answers as Record<string, unknown>)
        : undefined;
    if (row.isDraft) {
      return {
        submitted: false,
        draft: true,
        responseId: row.id,
        submissionId: row.submissionId ?? undefined,
        submittedAt: row.submittedAt.toISOString(),
        answers,
      };
    }
    return {
      submitted: true,
      draft: false,
      responseId: row.id,
      submissionId: row.submissionId ?? undefined,
      submittedAt: row.submittedAt.toISOString(),
      answers,
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

    // Admin list / analytics / compare: finalized submissions only (exclude in-progress drafts).
    const submittedWhere = { surveyId, isDraft: false as const };

    const total = await this.prisma.surveyResponse.count({
      where: submittedWhere,
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
      where: submittedWhere,
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
        publicRegistration: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
      },
    });

    const userIds = responses
      .map((r) => r.userId)
      .filter((id): id is string => id !== null);
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
        commentStageTags: r.commentStageTags ?? [],
        // Public registrants have no account: identify them by the name and
        // email they registered with.
        user: r.user ?? publicRespondent(r.publicRegistration),
        source: (r.publicRegistration ? 'public' : 'account') as
          | 'public'
          | 'account',
        registration: r.userId ? (regByUser.get(r.userId) ?? null) : null,
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
        responseId: r.id,
        score: r.score,
        answers: (r.answers ?? {}) as Record<string, unknown>,
        commentStageTags: r.commentStageTags ?? [],
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

  /**
   * SCRUM-291: landing dashboard aggregates for the admin survey workspace.
   * Totals + 30-day response trend are cheap counts; completion / ease / NPS
   * roll up HCP Beta–style FEEDBACK surveys (schema scoring metadata) with a cap.
   */
  async getWorkspaceStatsForAdmin(): Promise<{
    totalSurveys: number;
    totalResponses: number;
    completionRate: number | null;
    averageEaseScore: number | null;
    npsScore: number | null;
    responsesLast30Days: number;
    trend: Array<{ date: string; count: number }>;
    needsAttention: Array<{
      id: string;
      title: string;
      programTitle: string | null;
      reason: string;
      kind: 'no_responses' | 'low_completion';
      responseCount: number;
      completionRate: number | null;
    }>;
  }> {
    const now = new Date();
    const from = new Date(now);
    from.setUTCDate(from.getUTCDate() - 29);
    from.setUTCHours(0, 0, 0, 0);

    const submittedOnly = { isDraft: false as const };

    const [totalSurveys, totalResponses, recentResponses, surveys, responseCounts] =
      await Promise.all([
        this.prisma.survey.count(),
        this.prisma.surveyResponse.count({ where: submittedOnly }),
        this.prisma.surveyResponse.findMany({
          where: { ...submittedOnly, submittedAt: { gte: from } },
          select: { submittedAt: true },
        }),
        this.prisma.survey.findMany({
          select: {
            id: true,
            title: true,
            type: true,
            questions: true,
            programId: true,
            program: { select: { id: true, title: true } },
          },
          orderBy: { createdAt: 'desc' },
        }),
        this.prisma.surveyResponse.groupBy({
          by: ['surveyId'],
          where: submittedOnly,
          _count: { _all: true },
        }),
      ]);

    const countBySurvey = new Map(
      responseCounts.map((row) => [row.surveyId, row._count._all]),
    );

    const dayCounts = new Map<string, number>();
    for (let i = 0; i < 30; i++) {
      const d = new Date(from);
      d.setUTCDate(from.getUTCDate() + i);
      dayCounts.set(d.toISOString().slice(0, 10), 0);
    }
    for (const row of recentResponses) {
      const key = row.submittedAt.toISOString().slice(0, 10);
      if (dayCounts.has(key)) {
        dayCounts.set(key, (dayCounts.get(key) ?? 0) + 1);
      }
    }
    const trend = [...dayCounts.entries()].map(([date, count]) => ({
      date,
      count,
    }));
    const responsesLast30Days = recentResponses.length;

    const needsAttention: Array<{
      id: string;
      title: string;
      programTitle: string | null;
      reason: string;
      kind: 'no_responses' | 'low_completion';
      responseCount: number;
      completionRate: number | null;
    }> = [];

    for (const survey of surveys) {
      const responseCount = countBySurvey.get(survey.id) ?? 0;
      if (responseCount > 0) continue;
      needsAttention.push({
        id: survey.id,
        title: survey.title,
        programTitle: survey.program?.title ?? null,
        reason: 'No responses collected yet',
        kind: 'no_responses',
        responseCount: 0,
        completionRate: null,
      });
      if (needsAttention.length >= 8) break;
    }

    const betaCandidates = surveys
      .filter((s) => s.type === SurveyType.FEEDBACK && surveyHasBetaScoring(s.questions))
      .slice(0, WORKSPACE_BETA_SURVEY_CAP);

    let completionRate: number | null = null;
    let averageEaseScore: number | null = null;
    let npsScore: number | null = null;

    if (betaCandidates.length > 0) {
      const betaIds = betaCandidates.map((s) => s.id);
      const programIds = [
        ...new Set(
          betaCandidates
            .map((s) => s.programId)
            .filter((id): id is string => Boolean(id)),
        ),
      ];

      const [betaResponses, eligibleByProgram] = await Promise.all([
        this.prisma.surveyResponse.findMany({
          where: { surveyId: { in: betaIds }, isDraft: false },
          select: {
            id: true,
            surveyId: true,
            userId: true,
            submittedAt: true,
            score: true,
            answers: true,
            commentStageTags: true,
          },
        }),
        programIds.length > 0
          ? this.prisma.programRegistration.groupBy({
              by: ['programId'],
              where: {
                programId: { in: programIds },
                status: ProgramRegistrationStatus.APPROVED,
              },
              _count: { _all: true },
            })
          : Promise.resolve([]),
      ]);

      const eligibleMap = new Map<string, number>(
        eligibleByProgram.map(
          (row) => [row.programId, row._count._all] as [string, number],
        ),
      );
      const responsesBySurvey = new Map<string, typeof betaResponses>();
      for (const row of betaResponses) {
        const list = responsesBySurvey.get(row.surveyId) ?? [];
        list.push(row);
        responsesBySurvey.set(row.surveyId, list);
      }

      let eligibleSum = 0;
      let completedSum = 0;
      const easeAverages: number[] = [];
      let npsPromoters = 0;
      let npsPassives = 0;
      let npsDetractors = 0;

      for (const survey of betaCandidates) {
        const rows = responsesBySurvey.get(survey.id) ?? [];
        const eligibleCount: number | null =
          survey.programId && survey.type !== SurveyType.INTAKE
            ? (eligibleMap.get(survey.programId) ?? 0)
            : null;
        const analytics = buildSurveyResponseAnalytics({
          surveyType: survey.type,
          questionsSchema: survey.questions,
          eligibleCount,
          includeTextSamples: false,
          segmentBy: null,
          responses: rows.map((r) => ({
            submittedAt: r.submittedAt.toISOString(),
            userId: r.userId,
            responseId: r.id,
            score: r.score,
            answers: (r.answers ?? {}) as Record<string, unknown>,
            commentStageTags: r.commentStageTags ?? [],
          })),
        });

        const rate = analytics.totals.completionRate;
        if (rate && rate.eligible > 0) {
          eligibleSum += rate.eligible;
          completedSum += rate.completed;
          if (
            rate.rate < WORKSPACE_LOW_COMPLETION_RATE &&
            needsAttention.length < 12
          ) {
            const already = needsAttention.some((item) => item.id === survey.id);
            if (!already) {
              needsAttention.push({
                id: survey.id,
                title: survey.title,
                programTitle: survey.program?.title ?? null,
                reason: `${Math.round(rate.rate)}% completion (${rate.completed}/${rate.eligible})`,
                kind: 'low_completion',
                responseCount: countBySurvey.get(survey.id) ?? rows.length,
                completionRate: rate.rate,
              });
            }
          }
        }

        const beta = analytics.betaInsights;
        if (beta?.easeByStage?.length) {
          for (const stage of beta.easeByStage) {
            if (stage.average != null && stage.count > 0) {
              easeAverages.push(stage.average);
            }
          }
        }
        if (beta?.nps && beta.nps.totalRated > 0) {
          npsPromoters += beta.nps.promoters;
          npsPassives += beta.nps.passives;
          npsDetractors += beta.nps.detractors;
        }
      }

      if (eligibleSum > 0) {
        completionRate = Math.round((completedSum / eligibleSum) * 1000) / 10;
      }
      if (easeAverages.length > 0) {
        averageEaseScore =
          Math.round(
            (easeAverages.reduce((s, v) => s + v, 0) / easeAverages.length) * 100,
          ) / 100;
      }
      const npsRated = npsPromoters + npsPassives + npsDetractors;
      if (npsRated > 0) {
        npsScore = Math.round(((npsPromoters - npsDetractors) / npsRated) * 100);
      }
    }

    needsAttention.sort((a, b) => {
      if (a.kind !== b.kind) {
        return a.kind === 'low_completion' ? -1 : 1;
      }
      return a.title.localeCompare(b.title);
    });

    return {
      totalSurveys,
      totalResponses,
      completionRate,
      averageEaseScore,
      npsScore,
      responsesLast30Days,
      trend,
      needsAttention: needsAttention.slice(0, 8),
    };
  }

  /**
   * SCRUM-291: server-side search for the compare picker (FEEDBACK only).
   * Matches survey title or program title; always re-includes selected IDs.
   */
  async listCompareCandidatesForAdmin(opts: {
    q?: string;
    limit?: number;
    includeIds?: string[];
  } = {}): Promise<{
    items: Array<{
      id: string;
      title: string;
      type: SurveyType;
      isCustomized: boolean;
      responseCount: number;
      program: { id: string; title: string } | null;
    }>;
    totalMatching: number;
  }> {
    const q = (opts.q ?? '').trim();
    const limit = Math.min(Math.max(opts.limit ?? 50, 1), 100);
    const includeIds = [
      ...new Set(
        (opts.includeIds ?? [])
          .map((id) => id.trim())
          .filter((id) => id.length > 0),
      ),
    ].slice(0, 3);

    const select = {
      id: true,
      title: true,
      type: true,
      isCustomized: true,
      program: { select: { id: true, title: true } },
      _count: {
        select: { responses: { where: { isDraft: false } } },
      },
    } as const;

    const whereMatch = {
      type: SurveyType.FEEDBACK,
      ...(q
        ? {
            OR: [
              { title: { contains: q, mode: 'insensitive' as const } },
              {
                program: {
                  title: { contains: q, mode: 'insensitive' as const },
                },
              },
            ],
          }
        : {}),
    };

    const [totalMatching, rows] = await Promise.all([
      this.prisma.survey.count({ where: whereMatch }),
      this.prisma.survey.findMany({
        where: whereMatch,
        select,
        orderBy: [{ updatedAt: 'desc' }],
        take: limit,
      }),
    ]);

    const present = new Set(rows.map((r) => r.id));
    const missingIds = includeIds.filter((id) => !present.has(id));
    const pinned =
      missingIds.length > 0
        ? await this.prisma.survey.findMany({
            where: {
              id: { in: missingIds },
              type: SurveyType.FEEDBACK,
            },
            select,
          })
        : [];

    const mapRow = (r: (typeof rows)[number]) => ({
      id: r.id,
      title: r.title,
      type: r.type,
      isCustomized: r.isCustomized,
      responseCount: r._count.responses,
      program: r.program,
    });

    // Keep selected surveys first so the picker never "loses" a checked row.
    const pinnedOrdered = includeIds
      .map((id) => pinned.find((r) => r.id === id) ?? rows.find((r) => r.id === id))
      .filter((r): r is (typeof rows)[number] => Boolean(r));
    const rest = rows.filter((r) => !includeIds.includes(r.id));

    return {
      items: [...pinnedOrdered, ...rest].map(mapRow),
      totalMatching,
    };
  }

  /**
   * SCRUM-291: side-by-side compare for 2–3 FEEDBACK surveys (completion / ease / NPS
   * + shared rating/choice prompts when schemas align).
   */
  async compareSurveysForAdmin(rawIds: string[]): Promise<{
    columns: Array<{
      surveyId: string;
      title: string;
      type: SurveyType;
      program: { id: string; title: string } | null;
      responseCount: number;
      completionRate: {
        eligible: number;
        completed: number;
        rate: number;
      } | null;
      averageEase: number | null;
      easeByStage: Array<{
        stage: string;
        average: number | null;
        count: number;
      }>;
      nps: {
        score: number | null;
        promoters: number;
        passives: number;
        detractors: number;
        totalRated: number;
      } | null;
      hasNativeSchema: boolean;
      hasBetaInsights: boolean;
    }>;
    sharedQuestions: Array<{
      prompt: string;
      kind: 'rating' | 'choice';
      values: Array<{
        surveyId: string;
        mean: number | null;
        count: number;
        topOption: string | null;
        topPercentage: number | null;
      }>;
    }>;
    warnings: string[];
  }> {
    const ids = [
      ...new Set(
        rawIds
          .map((id) => id.trim())
          .filter((id) => id.length > 0),
      ),
    ];
    if (ids.length < 2 || ids.length > 3) {
      throw new BadRequestException(
        'Compare requires 2 or 3 distinct survey IDs.',
      );
    }

    const warnings: string[] = [];
    const packed = await Promise.all(
      ids.map(async (id) => {
        const result = await this.getResponseAnalyticsForAdmin(id, {
          includeTextSamples: false,
        });
        return result;
      }),
    );

    for (const row of packed) {
      if (row.survey.type !== SurveyType.FEEDBACK) {
        throw new BadRequestException(
          `Compare only supports FEEDBACK surveys (${row.survey.title} is ${row.survey.type}).`,
        );
      }
    }

    const fingerprints = packed.map((row) =>
      this.compareSchemaFingerprint(row.analytics.questions.map((q) => q.prompt)),
    );
    if (new Set(fingerprints).size > 1) {
      warnings.push(
        'Selected surveys do not share the same question set. Shared-question rows only include matching prompts.',
      );
    }
    if (packed.some((row) => !row.analytics.hasNativeSchema)) {
      warnings.push(
        'One or more surveys are Jotform-sourced; per-question compare may be limited.',
      );
    }
    if (packed.some((row) => !row.analytics.betaInsights)) {
      warnings.push(
        'Ease / NPS appear only when a survey schema declares HCP Beta scoring metadata.',
      );
    }

    const columns = packed.map((row) => {
      const beta = row.analytics.betaInsights;
      const easeByStage = beta?.easeByStage ?? [];
      const ratedEase = easeByStage.filter(
        (s) => s.average != null && s.count > 0,
      );
      const averageEase =
        ratedEase.length > 0
          ? Math.round(
              (ratedEase.reduce((sum, s) => sum + (s.average as number), 0) /
                ratedEase.length) *
                100,
            ) / 100
          : null;

      return {
        surveyId: row.survey.id,
        title: row.survey.title,
        type: row.survey.type,
        program: row.survey.program,
        responseCount: row.analytics.totals.totalResponses,
        completionRate: row.analytics.totals.completionRate,
        averageEase,
        easeByStage: easeByStage.map((s) => ({
          stage: s.stage,
          average: s.average,
          count: s.count,
        })),
        nps: beta?.nps
          ? {
              score: beta.nps.score,
              promoters: beta.nps.promoters,
              passives: beta.nps.passives,
              detractors: beta.nps.detractors,
              totalRated: beta.nps.totalRated,
            }
          : null,
        hasNativeSchema: row.analytics.hasNativeSchema,
        hasBetaInsights: Boolean(beta),
      };
    });

    const promptMaps = packed.map((row) => {
      const map = new Map<
        string,
        {
          kind: 'rating' | 'choice';
          mean: number | null;
          count: number;
          topOption: string | null;
          topPercentage: number | null;
        }
      >();
      for (const q of row.analytics.questions) {
        const key = this.normalizeComparePrompt(q.prompt);
        if (!key) continue;
        if (q.kind === 'rating') {
          map.set(key, {
            kind: 'rating',
            mean: q.mean,
            count: q.count,
            topOption: null,
            topPercentage: null,
          });
        } else if (q.kind === 'choice') {
          const top = [...q.options].sort((a, b) => b.count - a.count)[0];
          map.set(key, {
            kind: 'choice',
            mean: null,
            count: q.totalAnswered,
            topOption: top?.label ?? null,
            topPercentage: top?.percentage ?? null,
          });
        }
      }
      return map;
    });

    const sharedKeys = [...promptMaps[0].keys()].filter((key) =>
      promptMaps.every(
        (m) => m.has(key) && m.get(key)!.kind === promptMaps[0].get(key)!.kind,
      ),
    );

    const sharedQuestions = sharedKeys.slice(0, 5).map((key) => {
      const kind = promptMaps[0].get(key)!.kind;
      const displayPrompt =
        packed[0].analytics.questions.find(
          (q) => this.normalizeComparePrompt(q.prompt) === key,
        )?.prompt ?? key;
      return {
        prompt: displayPrompt,
        kind,
        values: packed.map((row, i) => {
          const cell = promptMaps[i].get(key)!;
          return {
            surveyId: row.survey.id,
            mean: cell.mean,
            count: cell.count,
            topOption: cell.topOption,
            topPercentage: cell.topPercentage,
          };
        }),
      };
    });

    return { columns, sharedQuestions, warnings };
  }

  private normalizeComparePrompt(prompt: string): string {
    return prompt.trim().toLowerCase().replace(/\s+/g, ' ');
  }

  private compareSchemaFingerprint(prompts: string[]): string {
    return prompts
      .map((p) => this.normalizeComparePrompt(p))
      .filter(Boolean)
      .sort()
      .join('|');
  }

  /**
   * Admin: tag a free-text comment with one or more HCP Beta stages
   * (access, registration, livestream, honorarium).
   */
  async updateCommentStageTags(
    responseId: string,
    stages: string[],
  ): Promise<{ id: string; commentStageTags: string[] }> {
    const allowed = new Set([
      'access',
      'registration',
      'livestream',
      'honorarium',
    ]);
    const unique = [
      ...new Set(
        stages
          .map((s) => s.trim().toLowerCase())
          .filter((s) => allowed.has(s)),
      ),
    ];
    const existing = await this.prisma.surveyResponse.findUnique({
      where: { id: responseId },
      select: { id: true },
    });
    if (!existing) throw new NotFoundException('Survey response not found');
    const updated = await this.prisma.surveyResponse.update({
      where: { id: responseId },
      data: { commentStageTags: unique },
      select: { id: true, commentStageTags: true },
    });
    return updated;
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
        user: r.user ?? { email: '', firstName: '', lastName: '' },
        registration:
          r.registration ??
          (r.source === 'public' ? { status: 'PUBLIC' } : null),
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
        _count: {
          select: { responses: { where: { isDraft: false } } },
        },
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
          title: `${programTitle} - HCP Beta Testing Survey`,
          description:
            'HCP Beta Testing Survey (platform access, registration, livestream, honorarium). Completing this survey is required before the beta honorarium can be issued.',
          questions: feedbackQuestions as object,
          type: 'FEEDBACK',
          required: true,
          jotformFormId: null,
          isCustomized: false,
          schemaVersion: 1,
        },
      });
    } else if (!feedback.isCustomized) {
      // Upgrade empty, non-customized FEEDBACK rows to the HCP Beta template.
      feedback = await this.upgradeFeedbackToHcpBetaIfNeeded(
        feedback,
        programTitle,
      );
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

    if (!intake || !feedback) {
      throw new BadRequestException(
        'Failed to ensure INTAKE and FEEDBACK surveys for program',
      );
    }

    this.logger.log(
      `Ensured surveys for program ${programId}: intake=${intake.id} feedback=${feedback.id}`,
    );

    return { intakeSurveyId: intake.id, feedbackSurveyId: feedback.id };
  }

  /**
   * Replace a non-customized FEEDBACK survey with the HCP Beta Testing template
   * when it has no responses yet and is not already on that template.
   */
  private async upgradeFeedbackToHcpBetaIfNeeded<
    T extends {
      id: string;
      questions: unknown;
      isCustomized: boolean;
      schemaVersion: number;
    },
  >(feedback: T, programTitle: string): Promise<T> {
    if (feedback.isCustomized) return feedback;
    const blob =
      feedback.questions && typeof feedback.questions === 'object'
        ? (feedback.questions as Record<string, unknown>)
        : null;
    if (blob?.templateId === HCP_BETA_TESTING_TEMPLATE_ID) {
      return feedback;
    }
    const responseCount = await this.prisma.surveyResponse.count({
      where: { surveyId: feedback.id },
    });
    if (responseCount > 0) return feedback;

    const feedbackQuestions = withNativeSchemaVersion(
      validateNativeSurveySchema(defaultPostEventFeedbackQuestions()),
      Math.max(1, feedback.schemaVersion || 1),
    );
    const updated = await this.prisma.survey.update({
      where: { id: feedback.id },
      data: {
        title: `${programTitle} - HCP Beta Testing Survey`,
        description:
          'HCP Beta Testing Survey (platform access, registration, livestream, honorarium). Completing this survey is required before the beta honorarium can be issued.',
        questions: feedbackQuestions as object,
        jotformFormId: null,
        isCustomized: false,
      },
    });
    return updated as unknown as T;
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
   * When `draft` is true, upserts answers only (no acknowledge / bonus).
   * Final submit creates SurveyResponse (or finalizes a draft) and may queue SURVEY_BONUS.
   */
  async submitResponse(
    surveyId: string,
    userId: string,
    role: UserRole,
    dto: SubmitSurveyResponseDto,
  ): Promise<{
    id: string;
    submissionId?: string;
    submittedAt: string;
    draft?: boolean;
    profileUpdated?: boolean;
    suggestedProfileUpdates?: Partial<SyncableUserProfile>;
  }> {
    await this.ensureUserCanAccessSurvey(surveyId, userId, role);
    assertNoIdentityFieldsInSurveyAnswers(dto.answers);
    const answers = stripIdentityFieldsFromSurveyAnswers(dto.answers);
    const asDraft = dto.draft === true;

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

    // Final FEEDBACK already complete — idempotent no-op.
    if (
      existing &&
      !existing.isDraft &&
      survey.type === SurveyType.FEEDBACK &&
      !asDraft
    ) {
      return {
        id: existing.id,
        submissionId: existing.submissionId ?? undefined,
        submittedAt: existing.submittedAt.toISOString(),
        draft: false,
      };
    }

    const wasDraftOrNew = !existing || existing.isDraft;
    let response: SurveyResponse;
    if (existing) {
      response = await this.prisma.surveyResponse.update({
        where: { id: existing.id },
        data: {
          answers: answers as object,
          score: dto.score,
          schemaVersion: survey.schemaVersion,
          submittedAt: new Date(),
          isDraft: asDraft,
          ...(!existing.submissionId ? { submissionId: randomUUID() } : {}),
        },
      });
      this.logger.log(
        `Survey ${surveyId} ${asDraft ? 'draft-saved' : 're-submitted'} by user ${userId}; schemaVersion=${survey.schemaVersion}`,
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
          isDraft: asDraft,
        },
      });
      this.logger.log(
        `Survey ${surveyId} ${asDraft ? 'draft-created' : 'submitted'} by user ${userId}`,
      );
    }

    let suggestedProfileUpdates: Partial<SyncableUserProfile> | undefined;
    let profileUpdated = false;

    if (!asDraft) {
      await this.formJotformProgress
        .clear(userId, FormJotformScope.SURVEY, surveyId)
        .catch(() => {});
      const profileWrite = await this.resolveProfileWriteFromSurveyAnswers(
        userId,
        surveyId,
        survey.questions,
        answers,
        dto.updateProfile === true,
      );
      suggestedProfileUpdates = profileWrite.suggested;
      profileUpdated = profileWrite.wrote;

      if (wasDraftOrNew) {
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
            phoneNumber: true,
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
    }

    if (survey.type === SurveyType.FEEDBACK && !asDraft) {
      // NPI / other profile fields write only via opt-in updateProfile.
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

    if (survey.type === SurveyType.INTAKE && !asDraft) {
      // Mark registration SURVEY_SUBMITTED — the wizard's explicit
      // "Submit registration" moves to PENDING/APPROVED. Profile fields
      // (including NPI) update only when updateProfile is opted in.
      const intakeSubmissionId = response.submissionId ?? response.id;
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
      draft: asDraft,
      profileUpdated,
      ...(suggestedProfileUpdates &&
      Object.keys(suggestedProfileUpdates).length > 0 &&
      !profileUpdated
        ? { suggestedProfileUpdates }
        : {}),
    };
  }

  /**
   * Compute profile diffs from survey answers. Writes only when
   * `updateProfile` is true (explicit opt-in). Never fails the survey submit.
   */
  private async resolveProfileWriteFromSurveyAnswers(
    userId: string,
    surveyId: string,
    questions: unknown,
    answers: Record<string, unknown>,
    updateProfile: boolean,
  ): Promise<{
    suggested: Partial<SyncableUserProfile>;
    wrote: boolean;
  }> {
    try {
      const proposed = extractProfileUpdatesFromAnswers(questions, answers);
      if (Object.keys(proposed).length === 0) {
        return { suggested: {}, wrote: false };
      }
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
          phoneNumber: true,
        },
      });
      if (!user) return { suggested: {}, wrote: false };
      const suggested = diffSuggestedProfileUpdates(user, proposed);
      if (Object.keys(suggested).length === 0) {
        return { suggested: {}, wrote: false };
      }
      if (!updateProfile) {
        return { suggested, wrote: false };
      }
      await this.prisma.user.update({
        where: { id: userId },
        data: suggested,
      });
      this.logger.log(
        `Survey ${surveyId}: opted-in profile write-back (${Object.keys(suggested).length} field(s)) for user ${userId}`,
      );
      return { suggested, wrote: true };
    } catch (err) {
      this.logger.error(
        `[Surveys] profile write-back failed for user ${userId} survey ${surveyId}: ${(err as Error).message}`,
      );
      return { suggested: {}, wrote: false };
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
        phoneNumber: true,
      },
    });
    if (!user) return {};
    return buildProfilePrefill(survey.questions, user);
  }
}

/** A public registrant shown in place of an account in admin response lists. */
function publicRespondent(
  reg: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
  } | null,
): {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  specialty: string | null;
} | null {
  return reg
    ? {
        id: `public:${reg.id}`,
        email: reg.email,
        firstName: reg.firstName,
        lastName: reg.lastName,
        specialty: null,
      }
    : null;
}

/** True when the native schema declares ease / NPS / comment scoring (HCP Beta). */
function surveyHasBetaScoring(questions: unknown): boolean {
  for (const q of listNativeSurveyQuestions(questions)) {
    const scoring = q.scoring;
    if (!scoring || typeof scoring !== 'object' || Array.isArray(scoring)) {
      continue;
    }
    const kind = String((scoring as { kind?: unknown }).kind ?? '');
    if (kind === 'ease' || kind === 'nps' || kind === 'comment') return true;
  }
  return false;
}
