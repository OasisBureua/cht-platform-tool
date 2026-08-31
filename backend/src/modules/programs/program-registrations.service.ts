import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  PaymentType,
  PostEventAttendanceStatus,
  ProgramRegistrationStatus,
  ProgramStatus,
  ProgramZoomSessionType,
  SurveyType,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { assertProfileCompleteForPayments } from '../../common/profile-payment-eligibility';
import { effectiveWebinarIntakeFormUrl } from '../../utils/webinar-intake-url';
import {
  isPostEventSurveyWithinWindow,
  getPostEventSurveyUnlockAt,
  loadProgramSurveyMeta,
  programHasPostEventSurvey,
  userHasIntakeSurveyResponse,
  userHasPostEventSurveyResponse,
} from '../../utils/program-survey-config';
import { buildProgramSessionIcs } from '../../utils/ics-calendar';
import { learnerWebinarJoinUrl } from '../../utils/webinar-join-url';
import { buildUserRecipientWhere } from '../admin/user-recipient-filters.util';
import { OutboundSyncService } from '../outbound-sync/outbound-sync.service';
import { SesEmailService } from '../email/ses-email.service';
import { InvitesService } from '../invites/invites.service';
import { QueueService } from '../../queue/queue.service';
import {
  matchRegistrationsToQualifiedAttendance,
  zoomPresenceForRegistration,
  type ZoomJoinEvidence,
  type ZoomTimedParticipantEvent,
} from '../webinars/zoom-attendance-match';

@Injectable()
export class ProgramRegistrationsService {
  private readonly logger = new Logger(ProgramRegistrationsService.name);

  /** Office hours meetings use fixed 10-minute registration windows; count scales with session duration (6 per hour). */
  private static readonly OFFICE_HOURS_SEGMENT_MINUTES = 10;

  /** Admins may revert an approval within this window (see adminUndoRegistrationApproval). */
  static readonly APPROVAL_UNDO_WINDOW_MS = 15 * 60 * 1000;

  /** Recently approved rows stay visible until session end + this buffer. */
  static readonly RECENTLY_APPROVED_AFTER_SESSION_MS = 60 * 60 * 1000;

  /** Session end (start + duration minutes), or null when start is unknown. */
  static sessionEndsAt(
    startDate: Date | null | undefined,
    durationMinutes: number | null | undefined,
  ): Date | null {
    if (!startDate) return null;
    const mins = durationMinutes ?? 60;
    return new Date(startDate.getTime() + mins * 60 * 1000);
  }

  /** True when half-open intervals [aStart, aEnd) and [bStart, bEnd) overlap. */
  static intervalsOverlap(
    aStart: Date,
    aEnd: Date,
    bStart: Date,
    bEnd: Date,
  ): boolean {
    return aStart.getTime() < bEnd.getTime() && bStart.getTime() < aEnd.getTime();
  }

  /** True while the registration should appear in the admin "Recently approved" section. */
  static isRecentlyApprovedVisible(
    reviewedAt: Date | null | undefined,
    startDate: Date | null | undefined,
    durationMinutes: number | null | undefined,
    nowMs: number = Date.now(),
  ): boolean {
    const sessionEnd = ProgramRegistrationsService.sessionEndsAt(
      startDate,
      durationMinutes,
    );
    if (sessionEnd) {
      return (
        sessionEnd.getTime() +
          ProgramRegistrationsService.RECENTLY_APPROVED_AFTER_SESSION_MS >
        nowMs
      );
    }
    if (!reviewedAt) return false;
    return (
      reviewedAt.getTime() +
        ProgramRegistrationsService.APPROVAL_UNDO_WINDOW_MS >
      nowMs
    );
  }

  constructor(
    private prisma: PrismaService,
    private outboundSync: OutboundSyncService,
    private config: ConfigService,
    private queueService: QueueService,
    private sesEmail: SesEmailService,
    private invites: InvitesService,
  ) {}

  private syncUserOutbound(user: {
    email: string;
    firstName: string;
    lastName: string;
    specialty?: string | null;
    institution?: string | null;
    city?: string | null;
    state?: string | null;
    zipCode?: string | null;
    npiNumber?: string | null;
  }): void {
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
        this.logger.error('[ProgramRegistrations] outbound-sync error:', err),
      );
  }

  private syncRegistrationEvent(
    user: {
      email: string;
      firstName: string;
      lastName: string;
      specialty?: string | null;
      institution?: string | null;
      city?: string | null;
      state?: string | null;
      zipCode?: string | null;
      npiNumber?: string | null;
    },
    program: { id: string; title: string },
    registrationStatus: string,
    event:
      | 'survey_submitted'
      | 'registration_pending'
      | 'registration_approved'
      | 'registration_rejected'
      | 'registration_updated',
  ): void {
    this.outboundSync
      .syncProgramEvent({
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        npiNumber: user.npiNumber,
        specialty: user.specialty,
        institution: user.institution,
        city: user.city,
        state: user.state,
        zipCode: user.zipCode,
        programId: program.id,
        programTitle: program.title,
        registrationStatus,
        event,
      })
      .catch((err) =>
        this.logger.error(
          '[ProgramRegistrations] outbound program-event error:',
          err,
        ),
      );
  }

  /**
   * Native intake survey completed: stamp SURVEY_SUBMITTED without enqueueing
   * for admin approval (learner must still finish "Submit registration").
   */
  async markIntakeSurveySubmitted(
    userId: string,
    programId: string,
    submissionId: string,
  ): Promise<void> {
    const program = await this.prisma.program.findFirst({
      where: {
        id: programId,
        status: 'PUBLISHED',
        zoomSessionType: { in: ['WEBINAR', 'MEETING'] },
      },
      select: {
        id: true,
        title: true,
        registrationRequiresApproval: true,
      },
    });
    if (!program) return;

    const existing = await this.prisma.programRegistration.findUnique({
      where: { userId_programId: { userId, programId } },
    });

    // Never downgrade APPROVED / PENDING — only stamp intake metadata.
    if (
      existing?.status === ProgramRegistrationStatus.APPROVED ||
      existing?.status === ProgramRegistrationStatus.PENDING
    ) {
      await this.prisma.programRegistration.update({
        where: { id: existing.id },
        data: {
          intakeSubmissionId: submissionId,
          intakeJotformSubmittedAt: new Date(),
        },
      });
      return;
    }

    const status = ProgramRegistrationStatus.SURVEY_SUBMITTED;
    if (existing) {
      await this.prisma.programRegistration.update({
        where: { id: existing.id },
        data: {
          status,
          intakeSubmissionId: submissionId,
          intakeJotformSubmittedAt: new Date(),
          reviewedAt: null,
          reviewedByUserId: null,
        },
      });
    } else {
      await this.prisma.programRegistration.create({
        data: {
          userId,
          programId,
          status,
          intakeSubmissionId: submissionId,
          intakeJotformSubmittedAt: new Date(),
        },
      });
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (user) {
      this.syncRegistrationEvent(
        user,
        program,
        status,
        'survey_submitted',
      );
    }
  }

  /**
   * LIVE programs with honorarium, post-event Jotform, or FEEDBACK survey need attendance verification after approval.
   */
  async resolvePostEventAttendanceStatusForNewApproval(
    programId: string,
  ): Promise<PostEventAttendanceStatus> {
    const program = await this.prisma.program.findUnique({
      where: { id: programId },
      select: {
        zoomSessionType: true,
        jotformSurveyUrl: true,
        honorariumAmount: true,
      },
    });
    if (
      !program ||
      (program.zoomSessionType !== ProgramZoomSessionType.WEBINAR &&
        program.zoomSessionType !== ProgramZoomSessionType.MEETING)
    ) {
      return PostEventAttendanceStatus.NOT_REQUIRED;
    }
    const hasHonorarium = (program.honorariumAmount ?? 0) > 0;
    const feedbackCount = await this.prisma.survey.count({
      where: { programId, type: 'FEEDBACK' },
    });
    const hasPostEventSurvey =
      !!program.jotformSurveyUrl?.trim() || feedbackCount > 0;
    if (hasHonorarium || hasPostEventSurvey) {
      return PostEventAttendanceStatus.PENDING_VERIFICATION;
    }
    return PostEventAttendanceStatus.NOT_REQUIRED;
  }

  /**
   * FEEDBACK (post-event) surveys: require enrollment, the same post-time window as notifications,
   * and for live (WEBINAR/MEETING) an approved registration with attendance verified or not required.
   */
  async canUserAccessPostEventFeedbackSurvey(
    userId: string,
    programId: string,
  ): Promise<boolean> {
    const program = await this.prisma.program.findUnique({
      where: { id: programId },
      select: {
        status: true,
        zoomSessionType: true,
        startDate: true,
        duration: true,
        zoomSessionEndedAt: true,
      },
    });
    if (!program || program.status !== ProgramStatus.PUBLISHED) {
      return false;
    }

    const enrolled = await this.prisma.programEnrollment.findUnique({
      where: { userId_programId: { userId, programId } },
      select: { id: true },
    });

    const reg = await this.prisma.programRegistration.findUnique({
      where: { userId_programId: { userId, programId } },
      select: { status: true, postEventAttendanceStatus: true },
    });

    if (!enrolled && (!reg || reg.status !== ProgramRegistrationStatus.APPROVED)) {
      return false;
    }

    const feedbackSurvey = await this.prisma.survey.findFirst({
      where: { programId, type: 'FEEDBACK' },
      orderBy: { createdAt: 'desc' },
      select: { id: true, createdAt: true },
    });
    if (!feedbackSurvey) {
      return false;
    }

    const now = new Date();
    const unlockAt = getPostEventSurveyUnlockAt(program);
    if (!isPostEventSurveyWithinWindow(unlockAt, now.getTime())) {
      return false;
    }

    if (
      program.zoomSessionType !== ProgramZoomSessionType.WEBINAR &&
      program.zoomSessionType !== ProgramZoomSessionType.MEETING
    ) {
      return true;
    }
    let postSurveyAllowed = false;
    if (program.zoomSessionEndedAt) {
      postSurveyAllowed = now >= program.zoomSessionEndedAt;
    } else if (program.startDate) {
      const durationMin = program.duration ?? 60;
      postSurveyAllowed =
        now.getTime() >= program.startDate.getTime() + durationMin * 60_000;
    } else if (program.zoomSessionType === ProgramZoomSessionType.MEETING) {
      postSurveyAllowed = true;
    } else {
      return false;
    }
    if (!postSurveyAllowed) {
      return false;
    }

    if (!reg || reg.status !== ProgramRegistrationStatus.APPROVED) {
      return false;
    }
    if (
      reg.postEventAttendanceStatus ===
      PostEventAttendanceStatus.PENDING_VERIFICATION
    ) {
      return false;
    }
    if (reg.postEventAttendanceStatus === PostEventAttendanceStatus.DENIED) {
      return false;
    }
    return (
      reg.postEventAttendanceStatus === PostEventAttendanceStatus.VERIFIED ||
      reg.postEventAttendanceStatus === PostEventAttendanceStatus.NOT_REQUIRED
    );
  }

  private assertProgramPostEventWindowOpen(program: {
    zoomSessionType: ProgramZoomSessionType | null;
    startDate: Date | null;
    duration: number | null;
    zoomSessionEndedAt: Date | null;
  }): void {
    const now = Date.now();
    if (program.zoomSessionEndedAt) {
      if (now < program.zoomSessionEndedAt.getTime()) {
        throw new BadRequestException(
          'Post-event steps unlock after the live session ends.',
        );
      }
      return;
    }
    if (program.zoomSessionType === ProgramZoomSessionType.MEETING) {
      return;
    }
    if (!program.startDate) {
      throw new BadRequestException('Session schedule is not set yet.');
    }
    const durMin = program.duration ?? 60;
    if (now < program.startDate.getTime() + durMin * 60_000) {
      throw new BadRequestException(
        'Post-event steps unlock after the scheduled session end.',
      );
    }
  }

  /**
   * When a MEETING has a start time and duration but no rows yet, create 10-minute slots end-to-end
   * (ceil(duration/10) segments, defaulting duration to 60 if missing).
   */
  private async ensureDefaultOfficeHoursSlots(
    programId: string,
    program: {
      zoomSessionType: string;
      startDate: Date | null;
      duration: number | null;
    },
  ): Promise<void> {
    if (program.zoomSessionType !== 'MEETING' || !program.startDate) return;

    const existing = await this.prisma.officeHoursSlot.count({
      where: { programId },
    });
    if (existing > 0) return;

    const durationMin =
      program.duration != null && program.duration > 0 ? program.duration : 60;
    const segment = ProgramRegistrationsService.OFFICE_HOURS_SEGMENT_MINUTES;
    const n = Math.max(1, Math.ceil(durationMin / segment));
    const startMs = program.startDate.getTime();
    const segMs = segment * 60_000;

    await this.prisma.officeHoursSlot.createMany({
      data: Array.from({ length: n }, (_, i) => ({
        programId,
        startsAt: new Date(startMs + i * segMs),
        endsAt: new Date(startMs + (i + 1) * segMs),
        label: null,
        maxAttendees: 1,
        sortOrder: i,
      })),
    });
    this.logger.log(
      `Auto-created ${n} office-hours slot(s) for program ${programId}`,
    );
  }

  async listSlotsForProgram(programId: string) {
    const program = await this.prisma.program.findUnique({
      where: { id: programId },
      select: {
        id: true,
        status: true,
        zoomSessionType: true,
        startDate: true,
        duration: true,
      },
    });
    if (!program || program.status !== 'PUBLISHED') {
      throw new NotFoundException('Program not found');
    }
    if (program.zoomSessionType !== 'MEETING') {
      return [];
    }
    await this.ensureDefaultOfficeHoursSlots(programId, program);
    const slots = await this.prisma.officeHoursSlot.findMany({
      where: { programId },
      orderBy: [{ sortOrder: 'asc' }, { startsAt: 'asc' }],
    });
    const counts = await this.prisma.programRegistration.groupBy({
      by: ['officeHoursSlotId'],
      where: {
        programId,
        status: {
          in: [
            ProgramRegistrationStatus.PENDING,
            ProgramRegistrationStatus.APPROVED,
          ],
        },
        NOT: { officeHoursSlotId: null },
      },
      _count: { id: true },
    });
    const countBySlot = new Map(
      counts
        .filter((c) => c.officeHoursSlotId)
        .map((c) => [c.officeHoursSlotId!, c._count.id]),
    );
    return slots.map((s) => ({
      id: s.id,
      startsAt: s.startsAt.toISOString(),
      endsAt: s.endsAt.toISOString(),
      label: s.label ?? undefined,
      maxAttendees: s.maxAttendees,
      remaining: Math.max(0, s.maxAttendees - (countBySlot.get(s.id) ?? 0)),
    }));
  }

  async getMyRegistration(userId: string, programId: string) {
    const reg = await this.prisma.programRegistration.findUnique({
      where: { userId_programId: { userId, programId } },
      include: { slot: true, program: true },
    });
    if (!reg) return null;

    const defaultIntake =
      this.config.get<string>('jotform.webinarDefaultIntakeUrl')?.trim() ||
      undefined;
    const surveyMeta = await loadProgramSurveyMeta(
      this.prisma,
      reg.program,
      defaultIntake,
    );

    const [postEventSurveySubmitted, intakeSurveySubmitted] = await Promise.all([
      userHasPostEventSurveyResponse(
        this.prisma,
        userId,
        surveyMeta.feedbackSurveyId,
      ),
      userHasIntakeSurveyResponse(
        this.prisma,
        userId,
        surveyMeta.intakeSurveyId,
        reg,
      ),
    ]);

    const honorariumPayment = await this.prisma.payment.findFirst({
      where: { userId, programId, type: 'HONORARIUM' },
      orderBy: { createdAt: 'desc' },
      select: { id: true, status: true },
    });

    return {
      id: reg.id,
      status: reg.status,
      officeHoursSlotId: reg.officeHoursSlotId ?? undefined,
      intakeSubmissionId: reg.intakeSubmissionId ?? undefined,
      intakeJotformSubmittedAt: reg.intakeJotformSubmittedAt?.toISOString(),
      createdAt: reg.createdAt.toISOString(),
      reviewedAt: reg.reviewedAt?.toISOString(),
      postEventAttendanceStatus: reg.postEventAttendanceStatus,
      postEventSurveyAcknowledgedAt:
        reg.postEventSurveyAcknowledgedAt?.toISOString(),
      postEventSurveySubmitted,
      intakeSurveySubmitted,
      hasPostEventSurvey: surveyMeta.hasPostEventSurvey,
      hasIntakeSurvey: surveyMeta.hasIntakeSurvey,
      feedbackSurveyId: surveyMeta.feedbackSurveyId,
      intakeSurveyId: surveyMeta.intakeSurveyId,
      honorariumRequestedAt: reg.honorariumRequestedAt?.toISOString(),
      honorariumPayment: honorariumPayment
        ? { id: honorariumPayment.id, status: honorariumPayment.status }
        : null,
    };
  }

  /**
   * LIVE / Office Hours list badges: enrollment + registration status per program for the current user.
   */
  async getMyLiveSessionStatusForLists(userId: string): Promise<
    Array<{
      programId: string;
      enrolled: boolean;
      registrationStatus: ProgramRegistrationStatus | null;
    }>
  > {
    const liveProgramWhere = {
      zoomSessionType: {
        in: [ProgramZoomSessionType.WEBINAR, ProgramZoomSessionType.MEETING],
      },
      status: ProgramStatus.PUBLISHED,
    };
    const [regs, enrolls] = await Promise.all([
      this.prisma.programRegistration.findMany({
        where: { userId, program: liveProgramWhere },
        select: { programId: true, status: true },
      }),
      this.prisma.programEnrollment.findMany({
        where: { userId, program: liveProgramWhere },
        select: { programId: true },
      }),
    ]);
    const enrollSet = new Set(enrolls.map((e) => e.programId));
    const map = new Map<
      string,
      { registrationStatus: ProgramRegistrationStatus | null }
    >();
    for (const r of regs) {
      map.set(r.programId, { registrationStatus: r.status });
    }
    for (const pid of enrollSet) {
      if (!map.has(pid)) map.set(pid, { registrationStatus: null });
    }
    return Array.from(map.entries()).map(
      ([programId, { registrationStatus }]) => ({
        programId,
        enrolled: enrollSet.has(programId),
        registrationStatus,
      }),
    );
  }

  /**
   * Submit or update registration. If program does not require approval, approves and enrolls immediately.
   */
  async submitRegistration(
    userId: string,
    programId: string,
    body: { officeHoursSlotId?: string; intakeSubmissionId?: string },
  ) {
    const program = await this.prisma.program.findUnique({
      where: { id: programId },
    });
    if (!program) throw new NotFoundException('Program not found');
    if (program.status !== 'PUBLISHED') {
      throw new BadRequestException('Program is not open for registration');
    }

    if (
      program.startDate &&
      Date.now() >= program.startDate.getTime()
    ) {
      throw new BadRequestException(
        'Registration closed when this session started. Join is only available if you were already approved.',
      );
    }

    const existingEnrollment = await this.prisma.programEnrollment.findUnique({
      where: { userId_programId: { userId, programId } },
    });
    if (existingEnrollment) {
      throw new BadRequestException('Already enrolled in this program');
    }

    const existingRegistration =
      await this.prisma.programRegistration.findUnique({
        where: { userId_programId: { userId, programId } },
      });

    const slotCount = await this.prisma.officeHoursSlot.count({
      where: { programId },
    });
    if (
      program.zoomSessionType === 'MEETING' &&
      slotCount > 0 &&
      !body.officeHoursSlotId
    ) {
      throw new BadRequestException(
        'Select a time slot for this office hours session',
      );
    }

    if (body.officeHoursSlotId) {
      const slot = await this.prisma.officeHoursSlot.findFirst({
        where: { id: body.officeHoursSlotId, programId },
      });
      if (!slot) throw new BadRequestException('Invalid time slot');
      const used = await this.prisma.programRegistration.count({
        where: {
          officeHoursSlotId: slot.id,
          status: {
            in: [
              ProgramRegistrationStatus.PENDING,
              ProgramRegistrationStatus.APPROVED,
            ],
          },
        },
      });
      if (used >= slot.maxAttendees) {
        throw new BadRequestException('This time slot is full');
      }
      await this.assertNoOverlappingLiveRegistration(userId, program, {
        startsAt: slot.startsAt,
        endsAt: slot.endsAt,
      });
    } else {
      await this.assertNoOverlappingLiveRegistration(userId, program);
    }

    const requiresApproval = program.registrationRequiresApproval;
    const status = requiresApproval
      ? ProgramRegistrationStatus.PENDING
      : ProgramRegistrationStatus.APPROVED;

    const becomesApproved =
      status === ProgramRegistrationStatus.APPROVED &&
      existingRegistration?.status !== ProgramRegistrationStatus.APPROVED;

    const intakeSid = body.intakeSubmissionId?.trim();
    const incomingIntakeDefined = body.intakeSubmissionId !== undefined;
    const mergedIntakeId = incomingIntakeDefined
      ? intakeSid || null
      : (existingRegistration?.intakeSubmissionId ?? null);

    const reg = await this.prisma.programRegistration.upsert({
      where: { userId_programId: { userId, programId } },
      create: {
        userId,
        programId,
        status,
        postEventAttendanceStatus:
          status === ProgramRegistrationStatus.APPROVED
            ? await this.resolvePostEventAttendanceStatusForNewApproval(
                programId,
              )
            : PostEventAttendanceStatus.NOT_REQUIRED,
        officeHoursSlotId: body.officeHoursSlotId ?? null,
        intakeSubmissionId: intakeSid || null,
        intakeJotformSubmittedAt: intakeSid ? new Date() : null,
      },
      update: {
        status,
        ...(status === ProgramRegistrationStatus.PENDING
          ? {
              postEventAttendanceStatus: PostEventAttendanceStatus.NOT_REQUIRED,
            }
          : becomesApproved
            ? {
                postEventAttendanceStatus:
                  await this.resolvePostEventAttendanceStatusForNewApproval(
                    programId,
                  ),
              }
            : {}),
        officeHoursSlotId: body.officeHoursSlotId ?? undefined,
        ...(incomingIntakeDefined
          ? { intakeSubmissionId: intakeSid || null }
          : {}),
        /** Refresh whenever they submit again and an intake id is on file (body or existing). */
        intakeJotformSubmittedAt: mergedIntakeId ? new Date() : null,
        updatedAt: new Date(),
        // Fresh pending request after rejection: clear last review so admins see a new queue item.
        ...(requiresApproval &&
        status === ProgramRegistrationStatus.PENDING &&
        existingRegistration?.status === ProgramRegistrationStatus.REJECTED
          ? { reviewedAt: null, reviewedByUserId: null }
          : {}),
      },
    });

    if (!requiresApproval) {
      await this.ensureEnrollment(userId, programId);
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (user) {
      this.syncRegistrationEvent(
        user,
        program,
        status,
        status === ProgramRegistrationStatus.APPROVED
          ? 'registration_approved'
          : status === ProgramRegistrationStatus.PENDING
            ? 'registration_pending'
            : 'registration_updated',
      );
    }

    this.logger.log(
      `Registration ${reg.id} for program ${programId} user ${userId} status=${status}`,
    );

    if (
      user?.email &&
      (program.zoomSessionType === ProgramZoomSessionType.WEBINAR ||
        program.zoomSessionType === ProgramZoomSessionType.MEETING)
    ) {
      void (async () => {
        if (requiresApproval && status === ProgramRegistrationStatus.PENDING) {
          await this.sesEmail.sendLiveSessionRegistrationSubmittedEmail({
            to: user.email,
            firstName: user.firstName || 'there',
            program: { id: program.id, title: program.title },
            sessionKind: program.zoomSessionType,
            requiresApproval: true,
          });
          return;
        }
        if (
          status === ProgramRegistrationStatus.APPROVED &&
          becomesApproved
        ) {
          const joinUrlForLearner = learnerWebinarJoinUrl(program.zoomJoinUrl);
          await this.sesEmail.sendLiveSessionRegistrationApprovedEmail({
            to: user.email,
            firstName: user.firstName || 'there',
            program: {
              id: program.id,
              title: program.title,
              description: program.description,
              startDate: program.startDate,
              duration: program.duration,
              honorariumAmount: program.honorariumAmount,
              hostDisplayName: program.hostDisplayName,
              sponsorName: program.sponsorName,
              zoomJoinUrl: joinUrlForLearner,
            },
            sessionKind: program.zoomSessionType,
          });
        }
      })().catch((e: Error) =>
        this.logger.warn(`Registration email side effect: ${e.message}`),
      );
    }

    return {
      id: reg.id,
      status: reg.status,
      enrolled: !requiresApproval,
    };
  }

  /**
   * Register the current user for multiple live webinars at once (approval requests when required).
   * Office Hours (MEETING) and sessions that need a time slot are skipped, use per-session registration.
   */
  async submitBatchRegistrations(
    userId: string,
    programIds: string[],
    intakeByProgramId?: Record<string, string>,
  ): Promise<{
    submitted: Array<{
      programId: string;
      title: string;
      status: string;
      enrolled: boolean;
    }>;
    skipped: Array<{ programId: string; title: string; reason: string }>;
    failed: Array<{ programId: string; title: string; message: string }>;
  }> {
    const uniqueIds = [
      ...new Set(programIds.map((id) => id.trim()).filter(Boolean)),
    ];
    if (uniqueIds.length === 0) {
      throw new BadRequestException('Select at least one webinar.');
    }
    if (uniqueIds.length > 25) {
      throw new BadRequestException(
        'You can register for at most 25 webinars at a time.',
      );
    }

    const submitted: Array<{
      programId: string;
      title: string;
      status: string;
      enrolled: boolean;
    }> = [];
    const skipped: Array<{
      programId: string;
      title: string;
      reason: string;
    }> = [];
    const failed: Array<{
      programId: string;
      title: string;
      message: string;
    }> = [];

    for (const programId of uniqueIds) {
      const program = await this.prisma.program.findUnique({
        where: { id: programId },
        select: {
          title: true,
          status: true,
          zoomSessionType: true,
        },
      });

      const title = program?.title?.trim() || 'Session';

      if (!program) {
        failed.push({
          programId,
          title,
          message: 'Session not found',
        });
        continue;
      }

      if (program.status !== ProgramStatus.PUBLISHED) {
        skipped.push({
          programId,
          title,
          reason: 'Session is not open for registration',
        });
        continue;
      }

      if (program.zoomSessionType !== ProgramZoomSessionType.WEBINAR) {
        skipped.push({
          programId,
          title,
          reason:
            'Office Hours must be registered individually (time slot required)',
        });
        continue;
      }

      const slotCount = await this.prisma.officeHoursSlot.count({
        where: { programId },
      });
      if (slotCount > 0) {
        skipped.push({
          programId,
          title,
          reason:
            'This session requires choosing a time slot, open it to register',
        });
        continue;
      }

      try {
        const intakeSid = intakeByProgramId?.[programId]?.trim();
        const result = await this.submitRegistration(userId, programId, {
          ...(intakeSid ? { intakeSubmissionId: intakeSid } : {}),
        });
        submitted.push({
          programId,
          title,
          status: result.status,
          enrolled: result.enrolled,
        });
      } catch (err: unknown) {
        const rawMessage: string | string[] =
          err instanceof BadRequestException
            ? ((err.getResponse() as { message?: string | string[] })
                ?.message ?? err.message)
            : err instanceof Error
              ? err.message
              : 'Registration failed';

        const normalized =
          typeof rawMessage === 'string'
            ? rawMessage
            : Array.isArray(rawMessage)
              ? rawMessage.join('; ')
              : 'Registration failed';

        if (
          normalized.toLowerCase().includes('already enrolled') ||
          normalized.toLowerCase().includes('time slot') ||
          normalized.toLowerCase().includes('scheduling conflict')
        ) {
          skipped.push({ programId, title, reason: normalized });
        } else {
          failed.push({ programId, title, message: normalized });
        }
      }
    }

    if (submitted.length === 0 && skipped.length === 0 && failed.length === 0) {
      throw new BadRequestException('No webinars could be processed.');
    }

    this.logger.log(
      `Batch registration user=${userId}: submitted=${submitted.length} skipped=${skipped.length} failed=${failed.length}`,
    );

    return { submitted, skipped, failed };
  }

  /**
   * Intake submitted (native survey or Jotform webhook): persist submission id and optionally enroll.
   */
  async recordWebinarIntakeSubmission(
    userId: string,
    programId: string,
    submissionId: string,
  ): Promise<boolean> {
    const program = await this.prisma.program.findFirst({
      where: {
        id: programId,
        status: 'PUBLISHED',
        zoomSessionType: { in: ['WEBINAR', 'MEETING'] },
      },
    });
    if (!program) {
      this.logger.warn(
        `Intake webhook: program ${programId} is not a published WEBINAR/MEETING session`,
      );
      return false;
    }
    const defaultIntake =
      this.config.get<string>('jotform.webinarDefaultIntakeUrl')?.trim() ||
      undefined;
    const surveyMeta = await loadProgramSurveyMeta(
      this.prisma,
      program,
      defaultIntake,
    );
    if (!surveyMeta.hasIntakeSurvey) {
      this.logger.warn(
        `Intake: program ${programId} has no intake survey configured`,
      );
      return false;
    }

    const enrolled = await this.prisma.programEnrollment.findUnique({
      where: { userId_programId: { userId, programId } },
    });
    if (enrolled) {
      const att =
        await this.resolvePostEventAttendanceStatusForNewApproval(programId);
      await this.prisma.programRegistration.upsert({
        where: { userId_programId: { userId, programId } },
        create: {
          userId,
          programId,
          status: ProgramRegistrationStatus.APPROVED,
          postEventAttendanceStatus: att,
          intakeSubmissionId: submissionId,
          intakeJotformSubmittedAt: new Date(),
        },
        update: {
          intakeSubmissionId: submissionId,
          intakeJotformSubmittedAt: new Date(),
        },
      });
      return true;
    }

    const existing = await this.prisma.programRegistration.findUnique({
      where: { userId_programId: { userId, programId } },
    });

    if (existing?.status === ProgramRegistrationStatus.APPROVED) {
      await this.prisma.programRegistration.update({
        where: { id: existing.id },
        data: {
          intakeSubmissionId: submissionId,
          intakeJotformSubmittedAt: new Date(),
        },
      });
      await this.ensureEnrollment(userId, programId);
      return true;
    }

    const requiresApproval = program.registrationRequiresApproval;
    const approvedNow = !requiresApproval;
    const attendanceIfApproved =
      await this.resolvePostEventAttendanceStatusForNewApproval(programId);

    if (!existing) {
      await this.prisma.programRegistration.create({
        data: {
          userId,
          programId,
          status: approvedNow
            ? ProgramRegistrationStatus.APPROVED
            : ProgramRegistrationStatus.SURVEY_SUBMITTED,
          postEventAttendanceStatus: approvedNow
            ? attendanceIfApproved
            : PostEventAttendanceStatus.NOT_REQUIRED,
          intakeSubmissionId: submissionId,
          intakeJotformSubmittedAt: new Date(),
        },
      });
    } else {
      const nextStatus = approvedNow
        ? ProgramRegistrationStatus.APPROVED
        : existing.status === ProgramRegistrationStatus.REJECTED
          ? ProgramRegistrationStatus.SURVEY_SUBMITTED
          : existing.status;
      const becomesApprovedHere =
        nextStatus === ProgramRegistrationStatus.APPROVED;
      await this.prisma.programRegistration.update({
        where: { id: existing.id },
        data: {
          intakeSubmissionId: submissionId,
          intakeJotformSubmittedAt: new Date(),
          status: nextStatus,
          ...(nextStatus === ProgramRegistrationStatus.PENDING ||
          nextStatus === ProgramRegistrationStatus.SURVEY_SUBMITTED
            ? {
                postEventAttendanceStatus:
                  PostEventAttendanceStatus.NOT_REQUIRED,
              }
            : becomesApprovedHere
              ? { postEventAttendanceStatus: attendanceIfApproved }
              : {}),
        },
      });
    }

    if (approvedNow) {
      await this.ensureEnrollment(userId, programId);
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (user) {
      this.syncRegistrationEvent(
        user,
        program,
        approvedNow
          ? ProgramRegistrationStatus.APPROVED
          : existing?.status === ProgramRegistrationStatus.PENDING
            ? ProgramRegistrationStatus.PENDING
            : ProgramRegistrationStatus.SURVEY_SUBMITTED,
        approvedNow ? 'registration_approved' : 'survey_submitted',
      );
    }

    this.logger.log(
      `Intake webhook: user ${userId} program ${programId} submission ${submissionId} approvedNow=${approvedNow}`,
    );
    return true;
  }

  /**
   * Block PENDING/APPROVED live-session registrations whose scheduled windows overlap.
   * Uses office-hours slot times when provided; otherwise program startDate + duration.
   */
  private async assertNoOverlappingLiveRegistration(
    userId: string,
    program: {
      id: string;
      title: string;
      startDate: Date | null;
      duration: number | null;
      zoomSessionType: ProgramZoomSessionType | null;
    },
    slotWindow?: { startsAt: Date; endsAt: Date },
  ): Promise<void> {
    if (
      program.zoomSessionType !== ProgramZoomSessionType.WEBINAR &&
      program.zoomSessionType !== ProgramZoomSessionType.MEETING
    ) {
      return;
    }

    const candidateStart = slotWindow?.startsAt ?? program.startDate ?? null;
    const candidateEnd =
      slotWindow?.endsAt ??
      ProgramRegistrationsService.sessionEndsAt(
        program.startDate,
        program.duration,
      );
    if (!candidateStart || !candidateEnd) {
      return;
    }
    if (candidateEnd.getTime() <= candidateStart.getTime()) {
      return;
    }

    const others = await this.prisma.programRegistration.findMany({
      where: {
        userId,
        programId: { not: program.id },
        status: {
          in: [
            ProgramRegistrationStatus.PENDING,
            ProgramRegistrationStatus.APPROVED,
          ],
        },
        program: {
          zoomSessionType: {
            in: [
              ProgramZoomSessionType.WEBINAR,
              ProgramZoomSessionType.MEETING,
            ],
          },
        },
      },
      select: {
        status: true,
        program: {
          select: {
            id: true,
            title: true,
            startDate: true,
            duration: true,
          },
        },
        slot: {
          select: {
            startsAt: true,
            endsAt: true,
          },
        },
      },
    });

    for (const reg of others) {
      const otherStart = reg.slot?.startsAt ?? reg.program.startDate ?? null;
      const otherEnd =
        reg.slot?.endsAt ??
        ProgramRegistrationsService.sessionEndsAt(
          reg.program.startDate,
          reg.program.duration,
        );
      if (!otherStart || !otherEnd) continue;
      if (
        !ProgramRegistrationsService.intervalsOverlap(
          candidateStart,
          candidateEnd,
          otherStart,
          otherEnd,
        )
      ) {
        continue;
      }

      const conflictTitle = reg.program.title?.trim() || 'another session';
      throw new BadRequestException(
        `Scheduling conflict: you are already registered for "${conflictTitle}", which overlaps this session. Choose a different session or wait until that registration is no longer pending/approved.`,
      );
    }
  }

  private async ensureEnrollment(userId: string, programId: string) {
    await this.prisma.programEnrollment.upsert({
      where: { userId_programId: { userId, programId } },
      create: {
        userId,
        programId,
        enrolledAt: new Date(),
        overallProgress: 0,
        completed: false,
      },
      update: {},
    });
  }

  async listRegistrationsForAdmin(programId: string) {
    return this.prisma.programRegistration.findMany({
      where: { programId },
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
        slot: true,
        program: {
          select: {
            jotformIntakeFormUrl: true,
            jotformSurveyUrl: true,
            zoomSessionType: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /** Zoom / Meeting SDK join+leave rows for a program (presence + duration). */
  async listZoomJoinEvidenceForProgram(
    programId: string,
  ): Promise<ZoomJoinEvidence[]> {
    return this.listZoomTimedEventsForProgram(programId);
  }

  async listZoomTimedEventsForProgram(
    programId: string,
  ): Promise<ZoomTimedParticipantEvent[]> {
    const rows = await this.prisma.webinarParticipantEvent.findMany({
      where: { programId },
      select: {
        userId: true,
        participantEmail: true,
        event: true,
        occurredAt: true,
      },
      orderBy: { occurredAt: 'asc' },
    });
    return rows.map((r) => ({
      userId: r.userId,
      participantEmail: r.participantEmail,
      event: r.event,
      occurredAt: r.occurredAt,
    }));
  }

  /**
   * After webinar/meeting ended: auto-VERIFY approved registrations whose
   * platform email (or userId) appears in Zoom for at least 30 minutes
   * (JOINED/LEFT webhook times, or join until session end if still in session).
   * Does not override DENIED / already VERIFIED / NOT_REQUIRED.
   */
  async autoVerifyAttendanceFromZoomJoins(
    programId: string,
  ): Promise<{ verifiedCount: number; matchedRegistrationIds: string[] }> {
    const [pending, timedEvents] = await Promise.all([
      this.prisma.programRegistration.findMany({
        where: {
          programId,
          status: ProgramRegistrationStatus.APPROVED,
          postEventAttendanceStatus:
            PostEventAttendanceStatus.PENDING_VERIFICATION,
        },
        select: {
          id: true,
          userId: true,
          user: { select: { email: true, firstName: true } },
          program: {
            select: {
              id: true,
              title: true,
              sponsorName: true,
              honorariumAmount: true,
              zoomSessionType: true,
              zoomSessionEndedAt: true,
            },
          },
        },
      }),
      this.listZoomTimedEventsForProgram(programId),
    ]);

    if (pending.length === 0 || timedEvents.length === 0) {
      return { verifiedCount: 0, matchedRegistrationIds: [] };
    }

    const sessionEndedAt = pending[0]?.program.zoomSessionEndedAt ?? null;
    const matches = matchRegistrationsToQualifiedAttendance(
      pending.map((r) => ({
        id: r.id,
        userId: r.userId,
        userEmail: r.user.email,
      })),
      timedEvents,
      sessionEndedAt,
    );

    const matchedIds: string[] = [];
    const now = new Date();

    for (const match of matches) {
      const reg = pending.find((r) => r.id === match.registrationId);
      if (!reg) continue;

      const updated = await this.prisma.programRegistration.updateMany({
        where: {
          id: reg.id,
          postEventAttendanceStatus:
            PostEventAttendanceStatus.PENDING_VERIFICATION,
        },
        data: {
          postEventAttendanceStatus: PostEventAttendanceStatus.VERIFIED,
          postEventAttendanceReviewedAt: now,
          postEventAttendanceReviewedByUserId: null,
        },
      });
      if (updated.count !== 1) continue;

      matchedIds.push(reg.id);
      await this.ensureEnrollment(reg.userId, programId);

      if (reg.user.email) {
        const feedbackSurvey = await this.prisma.survey.findFirst({
          where: { programId, type: SurveyType.FEEDBACK },
          select: { id: true },
          orderBy: { createdAt: 'desc' },
        });

        this.sesEmail
          .sendPostWebinarSurveyEmail({
            to: reg.user.email,
            firstName: reg.user.firstName ?? '',
            program: {
              id: reg.program.id,
              title: reg.program.title,
              sponsorName: reg.program.sponsorName,
              honorariumAmount: reg.program.honorariumAmount,
              zoomSessionType:
                reg.program.zoomSessionType ?? ProgramZoomSessionType.WEBINAR,
            },
            surveyUrl: null,
            feedbackSurveyId: feedbackSurvey?.id ?? null,
          })
          .catch((err: Error) =>
            this.logger.warn(
              `Failed to send post-webinar survey email after Zoom auto-verify for ${reg.id}: ${err.message}`,
            ),
          );
      }

      this.logger.log(
        `Zoom auto-verified attendance for registration ${reg.id} (matchedBy=${match.matchedBy}, ≥30min)`,
      );
    }

    return {
      verifiedCount: matchedIds.length,
      matchedRegistrationIds: matchedIds,
    };
  }

  /** Admin hub: map userId → Zoom join presence for a program. */
  async zoomJoinPresenceByUserId(programId: string): Promise<
    Map<
      string,
      { zoomJoined: boolean; zoomParticipantEmail: string | null }
    >
  > {
    const events = await this.listZoomJoinEvidenceForProgram(programId);
    const regs = await this.prisma.programRegistration.findMany({
      where: { programId },
      select: { userId: true, user: { select: { email: true } } },
    });
    const map = new Map<
      string,
      { zoomJoined: boolean; zoomParticipantEmail: string | null }
    >();
    for (const r of regs) {
      map.set(
        r.userId,
        zoomPresenceForRegistration(r.userId, r.user.email, events),
      );
    }
    return map;
  }

  /** All pending registrations for published LIVE webinars and office hours (cross-program admin queue). */
  async listPendingWebinarRegistrationsForAdmin() {
    return this.prisma.programRegistration.findMany({
      where: {
        status: ProgramRegistrationStatus.PENDING,
        program: {
          zoomSessionType: { in: ['WEBINAR', 'MEETING'] },
          status: 'PUBLISHED',
          registrationRequiresApproval: true,
        },
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            specialty: true,
            institution: true,
            city: true,
          },
        },
        program: {
          select: {
            id: true,
            title: true,
            jotformIntakeFormUrl: true,
            zoomSessionType: true,
            zoomJoinUrl: true,
            startDate: true,
            duration: true,
          },
        },
      },
      /** Resubmits after rejection bump updatedAt: sort by that so queue order matches “last touch”. */
      orderBy: { updatedAt: 'asc' },
    });
  }

  /**
   * Recently approved registrations for the admin queue (newest first).
   * Visible until session end + 1 hour (or 15 minutes after approval when no start time).
   */
  async listRecentlyApprovedRegistrationsForAdminUndo() {
    const rows = await this.prisma.programRegistration.findMany({
      where: {
        status: ProgramRegistrationStatus.APPROVED,
        reviewedAt: { not: null },
        program: {
          zoomSessionType: { in: ['WEBINAR', 'MEETING'] },
          status: 'PUBLISHED',
          registrationRequiresApproval: true,
        },
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            specialty: true,
            institution: true,
            city: true,
          },
        },
        program: {
          select: {
            id: true,
            title: true,
            jotformIntakeFormUrl: true,
            zoomSessionType: true,
            zoomJoinUrl: true,
            startDate: true,
            duration: true,
          },
        },
      },
      orderBy: { reviewedAt: 'desc' },
    });
    return rows.filter((r) =>
      ProgramRegistrationsService.isRecentlyApprovedVisible(
        r.reviewedAt,
        r.program.startDate,
        r.program.duration,
      ),
    );
  }

  /**
   * Email learners a link to the multi-webinar registration landing page (pre-selected sessions).
   */
  async sendRegistrationInvites(opts: {
    programIds: string[];
    userIds?: string[];
    emails?: string[];
    role?: 'HCP' | 'KOL';
    cities?: string[];
    states?: string[];
    institutions?: string[];
  }): Promise<{
    registerUrl: string;
    programs: { id: string; title: string }[];
    emailed: number;
    skipped: { userId: string; email: string; reason: string }[];
  }> {
    const uniqueProgramIds = [
      ...new Set(opts.programIds.map((id) => id.trim()).filter(Boolean)),
    ];
    if (uniqueProgramIds.length === 0) {
      throw new BadRequestException('Select at least one webinar.');
    }

    const programs = await this.prisma.program.findMany({
      where: {
        id: { in: uniqueProgramIds },
        status: ProgramStatus.PUBLISHED,
        zoomSessionType: ProgramZoomSessionType.WEBINAR,
      },
      select: { id: true, title: true, startDate: true },
      orderBy: { startDate: 'asc' },
    });
    if (programs.length === 0) {
      throw new BadRequestException(
        'No published webinars found for the selected programs.',
      );
    }

    const base = (
      this.config.get<string>('frontendUrl') || 'https://communityhealth.media'
    ).replace(/\/$/, '');
    const registerUrl = `${base}/app/live/register-multiple?programs=${programs.map((p) => p.id).join(',')}`;

    let userIds = opts.userIds?.length ? [...new Set(opts.userIds)] : undefined;
    const rawEmails = (opts.emails ?? [])
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);
    const inviteEmails = [...new Set(rawEmails)];

    if (!userIds?.length && opts.role) {
      const cities = opts.cities?.map((v) => v.trim()).filter(Boolean);
      const states = opts.states?.map((v) => v.trim()).filter(Boolean);
      const institutions = opts.institutions?.map((v) => v.trim()).filter(Boolean);
      const users = await this.prisma.user.findMany({
        where: buildUserRecipientWhere({
          role: opts.role,
          status: 'ACTIVE',
          cities: cities?.length ? cities : undefined,
          states: states?.length ? states : undefined,
          institutions: institutions?.length ? institutions : undefined,
        }),
        select: { id: true },
      });
      userIds = users.map((u) => u.id);
    }
    if (!userIds?.length && !inviteEmails.length) {
      throw new BadRequestException(
        'Select at least one recipient, choose a role (HCP / KOL), or enter email addresses.',
      );
    }

    const users = userIds?.length
      ? await this.prisma.user.findMany({
          where: { id: { in: userIds }, status: 'ACTIVE' },
          select: { id: true, email: true, firstName: true },
        })
      : [];

    // Consolidate raw emails that match existing user accounts — send once with
    // the account's firstName rather than as an unregistered invite.
    const registeredEmailLower = new Set(
      users.map((u) => u.email?.toLowerCase()).filter(Boolean) as string[],
    );
    const matchedExistingUsers = inviteEmails.length
      ? await this.prisma.user.findMany({
          where: {
            email: { in: inviteEmails, mode: 'insensitive' },
            status: 'ACTIVE',
          },
          select: { id: true, email: true, firstName: true },
        })
      : [];
    const usersById = new Map(users.map((u) => [u.id, u]));
    for (const u of matchedExistingUsers) {
      if (!usersById.has(u.id)) usersById.set(u.id, u);
    }
    const mergedUsers = [...usersById.values()];

    const usersByEmailLower = new Set(
      mergedUsers.map((u) => u.email?.toLowerCase()).filter(Boolean) as string[],
    );
    const unregisteredEmails = inviteEmails.filter(
      (e) => !usersByEmailLower.has(e),
    );

    const skipped: { userId: string; email: string; reason: string }[] = [];
    let emailed = 0;
    for (const user of mergedUsers) {
      if (!user.email?.trim()) {
        skipped.push({
          userId: user.id,
          email: '',
          reason: 'No email on file',
        });
        continue;
      }
      try {
        await this.sesEmail.sendRegistrationInviteEmail({
          to: user.email,
          firstName: user.firstName ?? '',
          programTitles: programs.map((p) => p.title),
          registerUrl,
        });
        emailed += 1;
      } catch (err) {
        skipped.push({
          userId: user.id,
          email: user.email,
          reason: (err as Error).message,
        });
      }
    }
    // SCRUM-175: unregistered recipients get an opaque-token invite URL that
    // resolves server-side to pre-fill the /join signup form with their email
    // + the target programs. Keeps email PII out of URLs and lets us revoke or
    // expire links.
    for (const email of unregisteredEmails) {
      try {
        const { token } = await this.invites.createInvite({
          email,
          programIds: programs.map((p) => p.id),
        });
        const inviteUrl = `${base}/join?invite=${encodeURIComponent(token)}`;
        await this.sesEmail.sendRegistrationInviteEmail({
          to: email,
          firstName: '',
          programTitles: programs.map((p) => p.title),
          registerUrl: inviteUrl,
        });
        emailed += 1;
      } catch (err) {
        skipped.push({
          userId: '',
          email,
          reason: (err as Error).message,
        });
      }
    }

    return {
      registerUrl,
      programs: programs.map((p) => ({ id: p.id, title: p.title })),
      emailed,
      skipped,
    };
  }

  async adminUndoRegistrationApproval(
    adminUserId: string,
    registrationId: string,
  ) {
    const reg = await this.prisma.programRegistration.findUnique({
      where: { id: registrationId },
    });
    if (!reg) throw new NotFoundException('Registration not found');
    if (reg.status !== ProgramRegistrationStatus.APPROVED) {
      throw new BadRequestException(
        'Only approved registrations can be undone.',
      );
    }
    if (!reg.reviewedAt) {
      throw new BadRequestException('Registration has no approval timestamp.');
    }
    const elapsedMs = Date.now() - reg.reviewedAt.getTime();
    if (elapsedMs > ProgramRegistrationsService.APPROVAL_UNDO_WINDOW_MS) {
      throw new BadRequestException(
        'Undo window expired. Approvals can only be undone within 15 minutes.',
      );
    }
    return this.adminSetRegistrationStatus(
      adminUserId,
      registrationId,
      ProgramRegistrationStatus.PENDING,
      'Approval undone by admin',
    );
  }

  async adminSetRegistrationStatus(
    adminUserId: string,
    registrationId: string,
    status: ProgramRegistrationStatus,
    adminNotes?: string,
    emailOpts?: { rejectEmailReason?: 'GENERIC' | 'INCOMPLETE_INTAKE' },
  ) {
    const reg = await this.prisma.programRegistration.findUnique({
      where: { id: registrationId },
      include: { program: true },
    });
    if (!reg) throw new NotFoundException('Registration not found');

    const previousStatus = reg.status;

    const nextAttendance =
      status === ProgramRegistrationStatus.APPROVED
        ? await this.resolvePostEventAttendanceStatusForNewApproval(
            reg.programId,
          )
        : PostEventAttendanceStatus.NOT_REQUIRED;

    const normalizedNotes =
      adminNotes === undefined
        ? undefined
        : adminNotes === null ||
            (typeof adminNotes === 'string' && adminNotes.trim() === '')
          ? null
          : String(adminNotes).trim().slice(0, 8000);

    const updated = await this.prisma.$transaction(async (tx) => {
      const row = await tx.programRegistration.update({
        where: { id: registrationId },
        data: {
          status,
          postEventAttendanceStatus: nextAttendance,
          adminNotes:
            normalizedNotes !== undefined ? normalizedNotes : undefined,
          reviewedAt: new Date(),
          reviewedByUserId: adminUserId,
          ...(status === ProgramRegistrationStatus.REJECTED
            ? {
                postEventSurveyAcknowledgedAt: null,
                honorariumRequestedAt: null,
                postEventAttendanceReviewedAt: null,
                postEventAttendanceReviewedByUserId: null,
              }
            : {}),
          ...(status === ProgramRegistrationStatus.PENDING &&
          previousStatus === ProgramRegistrationStatus.APPROVED
            ? {
                postEventAttendanceStatus:
                  PostEventAttendanceStatus.NOT_REQUIRED,
                postEventSurveyAcknowledgedAt: null,
                honorariumRequestedAt: null,
                postEventAttendanceReviewedAt: null,
                postEventAttendanceReviewedByUserId: null,
                reviewedAt: null,
                reviewedByUserId: null,
              }
            : {}),
        },
      });

      if (status === ProgramRegistrationStatus.APPROVED) {
        await tx.programEnrollment.upsert({
          where: {
            userId_programId: { userId: reg.userId, programId: reg.programId },
          },
          create: {
            userId: reg.userId,
            programId: reg.programId,
            enrolledAt: new Date(),
            overallProgress: 0,
            completed: false,
          },
          update: {},
        });
      }

      if (status === ProgramRegistrationStatus.REJECTED) {
        await tx.programEnrollment.deleteMany({
          where: { userId: reg.userId, programId: reg.programId },
        });
      }

      if (
        status === ProgramRegistrationStatus.PENDING &&
        previousStatus === ProgramRegistrationStatus.APPROVED
      ) {
        await tx.programEnrollment.deleteMany({
          where: { userId: reg.userId, programId: reg.programId },
        });
      }

      return row;
    });

    if (
      status === ProgramRegistrationStatus.APPROVED &&
      previousStatus !== ProgramRegistrationStatus.APPROVED &&
      (reg.program.zoomSessionType === ProgramZoomSessionType.WEBINAR ||
        reg.program.zoomSessionType === ProgramZoomSessionType.MEETING)
    ) {
      void (async () => {
        const u = await this.prisma.user.findUnique({
          where: { id: reg.userId },
          select: { email: true, firstName: true, lastName: true },
        });
        if (!u?.email) {
          return;
        }
        const joinUrlForLearner = learnerWebinarJoinUrl(
          reg.program.zoomJoinUrl,
        );
        await this.sesEmail.sendLiveSessionRegistrationApprovedEmail({
          to: u.email,
          firstName: u.firstName || 'there',
          program: {
            id: reg.program.id,
            title: reg.program.title,
            description: reg.program.description,
            startDate: reg.program.startDate,
            duration: reg.program.duration,
            honorariumAmount: reg.program.honorariumAmount,
            hostDisplayName: reg.program.hostDisplayName,
            sponsorName: reg.program.sponsorName,
            zoomJoinUrl: joinUrlForLearner,
          },
          sessionKind: reg.program.zoomSessionType,
        });
      })().catch((e: Error) =>
        this.logger.warn(
          `Registration-approved email side effect: ${e.message}`,
        ),
      );
    }

    if (
      status === ProgramRegistrationStatus.REJECTED &&
      previousStatus !== ProgramRegistrationStatus.REJECTED &&
      (reg.program.zoomSessionType === ProgramZoomSessionType.WEBINAR ||
        reg.program.zoomSessionType === ProgramZoomSessionType.MEETING)
    ) {
      const rejectReason =
        emailOpts?.rejectEmailReason === 'INCOMPLETE_INTAKE'
          ? 'INCOMPLETE_INTAKE'
          : 'GENERIC';
      const noteForEmail = (normalizedNotes ?? '')
        .toString()
        .trim()
        .slice(0, 2000);
      void (async () => {
        const u = await this.prisma.user.findUnique({
          where: { id: reg.userId },
          select: { email: true, firstName: true },
        });
        if (!u?.email) {
          return;
        }
        await this.sesEmail.sendLiveSessionRegistrationRejectedEmail({
          to: u.email,
          firstName: u.firstName || 'there',
          program: { id: reg.program.id, title: reg.program.title },
          sessionKind: reg.program.zoomSessionType,
          reason: rejectReason,
          adminNote: noteForEmail,
        });
      })().catch((e: Error) =>
        this.logger.warn(
          `Registration-rejected email side effect: ${e.message}`,
        ),
      );
    }

    const userForSync = await this.prisma.user.findUnique({
      where: { id: reg.userId },
    });
    if (userForSync && status !== previousStatus) {
      this.syncRegistrationEvent(
        userForSync,
        reg.program,
        status,
        status === ProgramRegistrationStatus.APPROVED
          ? 'registration_approved'
          : status === ProgramRegistrationStatus.REJECTED
            ? 'registration_rejected'
            : status === ProgramRegistrationStatus.PENDING
              ? 'registration_pending'
              : 'registration_updated',
      );
    }

    return updated;
  }

  /**
   * Remove a user's enrollment from a program and mark their registration rejected so they may register again.
   */
  async adminRemoveEnrollment(
    adminUserId: string,
    programId: string,
    enrollmentId: string,
  ) {
    const enrollment = await this.prisma.programEnrollment.findUnique({
      where: { id: enrollmentId },
    });
    if (!enrollment || enrollment.programId !== programId) {
      throw new NotFoundException('Enrollment not found');
    }

    const REVOKED_NOTE =
      'Enrollment removed by admin; learner may register again.';

    await this.prisma.$transaction(async (tx) => {
      await tx.programEnrollment.delete({ where: { id: enrollmentId } });
      const reg = await tx.programRegistration.findUnique({
        where: {
          userId_programId: {
            userId: enrollment.userId,
            programId: enrollment.programId,
          },
        },
      });
      if (reg) {
        await tx.programRegistration.update({
          where: { id: reg.id },
          data: {
            status: ProgramRegistrationStatus.REJECTED,
            postEventAttendanceStatus: PostEventAttendanceStatus.NOT_REQUIRED,
            postEventSurveyAcknowledgedAt: null,
            honorariumRequestedAt: null,
            postEventAttendanceReviewedAt: null,
            postEventAttendanceReviewedByUserId: null,
            reviewedAt: new Date(),
            reviewedByUserId: adminUserId,
            adminNotes: REVOKED_NOTE,
          },
        });
      }
    });

    this.logger.log(
      `Admin ${adminUserId} removed enrollment ${enrollmentId} (program ${programId})`,
    );

    // SCRUM-179: notify the learner that their approval was rescinded.
    // Fire-and-forget after the DB commit so an SES failure never blocks the API.
    void (async () => {
      const [user, program] = await Promise.all([
        this.prisma.user.findUnique({
          where: { id: enrollment.userId },
          select: { email: true, firstName: true },
        }),
        this.prisma.program.findUnique({
          where: { id: enrollment.programId },
          select: { id: true, title: true, zoomSessionType: true },
        }),
      ]);
      if (!user?.email || !program?.zoomSessionType) return;
      await this.sesEmail.sendLiveSessionRegistrationRevokedEmail({
        to: user.email,
        firstName: user.firstName || 'there',
        program: { id: program.id, title: program.title },
        sessionKind: program.zoomSessionType,
        adminNote: REVOKED_NOTE,
      });
    })().catch((e: Error) =>
      this.logger.warn(
        `Registration-revoked email side effect: ${e.message}`,
      ),
    );

    return { removed: true };
  }

  async acknowledgePostEventSurvey(userId: string, programId: string) {
    const program = await this.prisma.program.findUnique({
      where: { id: programId },
      select: {
        jotformSurveyUrl: true,
        jotformIntakeFormUrl: true,
        zoomSessionType: true,
        startDate: true,
        duration: true,
        zoomSessionEndedAt: true,
      },
    });
    if (!program) throw new NotFoundException('Program not found');

    const defaultIntake =
      this.config.get<string>('jotform.webinarDefaultIntakeUrl')?.trim() ||
      undefined;
    const surveyMeta = await loadProgramSurveyMeta(
      this.prisma,
      { id: programId, ...program },
      defaultIntake,
    );
    if (!surveyMeta.hasPostEventSurvey) {
      throw new BadRequestException(
        'This program does not have a post-event survey.',
      );
    }
    this.assertProgramPostEventWindowOpen(program);

    const reg = await this.prisma.programRegistration.findUnique({
      where: { userId_programId: { userId, programId } },
    });
    if (!reg || reg.status !== ProgramRegistrationStatus.APPROVED) {
      throw new ForbiddenException('Your registration must be approved.');
    }
    if (
      reg.postEventAttendanceStatus ===
      PostEventAttendanceStatus.PENDING_VERIFICATION
    ) {
      throw new BadRequestException(
        'An administrator must confirm your attendance before you can complete the post-event survey.',
      );
    }
    if (reg.postEventAttendanceStatus === PostEventAttendanceStatus.DENIED) {
      throw new ForbiddenException(
        'Attendance was not verified for this session.',
      );
    }

    const submitted = await userHasPostEventSurveyResponse(
      this.prisma,
      userId,
      surveyMeta.feedbackSurveyId,
    );
    if (!submitted) {
      throw new BadRequestException(
        'Submit the post-event survey before acknowledging completion.',
      );
    }

    if (reg.postEventSurveyAcknowledgedAt) {
      return reg;
    }

    return this.prisma.programRegistration.update({
      where: { id: reg.id },
      data: {
        postEventSurveyAcknowledgedAt: new Date(),
      },
    });
  }

  async requestPostEventHonorariumPayout(userId: string, programId: string) {
    const program = await this.prisma.program.findUnique({
      where: { id: programId },
      select: {
        honorariumAmount: true,
        jotformSurveyUrl: true,
        zoomSessionType: true,
        startDate: true,
        duration: true,
        zoomSessionEndedAt: true,
      },
    });
    if (!program) throw new NotFoundException('Program not found');
    if (!program.honorariumAmount || program.honorariumAmount <= 0) {
      throw new BadRequestException(
        'This program does not include an honorarium.',
      );
    }

    this.assertProgramPostEventWindowOpen(program);

    const reg = await this.prisma.programRegistration.findUnique({
      where: { userId_programId: { userId, programId } },
    });
    if (!reg || reg.status !== ProgramRegistrationStatus.APPROVED) {
      throw new ForbiddenException('Your registration must be approved.');
    }
    const attendanceEligible =
      reg.postEventAttendanceStatus === PostEventAttendanceStatus.VERIFIED ||
      reg.postEventAttendanceStatus === PostEventAttendanceStatus.NOT_REQUIRED;

    if (reg.postEventAttendanceStatus === PostEventAttendanceStatus.DENIED) {
      throw new ForbiddenException(
        'Attendance was not verified for this session.',
      );
    }
    if (!attendanceEligible) {
      throw new BadRequestException(
        'Attendance must be verified before requesting payment.',
      );
    }

    if (reg.honorariumRequestedAt) {
      const existing = await this.prisma.payment.findFirst({
        where: {
          userId,
          programId,
          type: PaymentType.HONORARIUM,
          status: { in: ['PENDING', 'PROCESSING', 'PAID'] },
        },
        orderBy: { createdAt: 'desc' },
      });
      return {
        paymentId: existing?.id ?? null,
        created: false,
        alreadyRequested: true as const,
      };
    }

    const hasPostEventSurvey = await programHasPostEventSurvey(
      this.prisma,
      programId,
      program.jotformSurveyUrl,
    );
    if (hasPostEventSurvey && !reg.postEventSurveyAcknowledgedAt) {
      throw new BadRequestException(
        'Complete and acknowledge the post-event survey first.',
      );
    }

    const payUser = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        specialty: true,
        npiNumber: true,
        billVendorId: true,
        w9Submitted: true,
      },
    });
    if (!payUser) throw new NotFoundException('User not found');
    assertProfileCompleteForPayments(payUser);
    if (!payUser.billVendorId) {
      throw new BadRequestException(
        'Add your payment profile under Payments before requesting an honorarium.',
      );
    }
    if (!payUser.w9Submitted) {
      throw new BadRequestException(
        'Submit your W-9 under Payments before requesting an honorarium.',
      );
    }

    const claimed = await this.prisma.programRegistration.updateMany({
      where: {
        id: reg.id,
        honorariumRequestedAt: null,
      },
      data: { honorariumRequestedAt: new Date() },
    });

    if (claimed.count === 0) {
      const existing = await this.prisma.payment.findFirst({
        where: {
          userId,
          programId,
          type: PaymentType.HONORARIUM,
          status: { in: ['PENDING', 'PROCESSING', 'PAID'] },
        },
        orderBy: { createdAt: 'desc' },
      });
      return {
        paymentId: existing?.id ?? null,
        created: false,
        alreadyRequested: true as const,
      };
    }

    const queued = await this.queueService.processPayment(
      userId,
      program.honorariumAmount,
      'HONORARIUM',
      programId,
      `honorarium:${userId}:${programId}`,
    );

    if (!queued) {
      await this.prisma.programRegistration.update({
        where: { id: reg.id },
        data: { honorariumRequestedAt: null },
      });
      throw new ServiceUnavailableException(
        'Could not queue honorarium. Check configuration or try again in a moment.',
      );
    }

    return {
      paymentId: null,
      created: true,
    };
  }

  async adminSetPostEventAttendance(
    adminUserId: string,
    registrationId: string,
    status: 'VERIFIED' | 'DENIED',
  ) {
    if (status !== 'VERIFIED' && status !== 'DENIED') {
      throw new BadRequestException('status must be VERIFIED or DENIED');
    }
    const reg = await this.prisma.programRegistration.findUnique({
      where: { id: registrationId },
      include: {
        user: { select: { email: true, firstName: true } },
        program: {
          select: {
            id: true,
            title: true,
            description: true,
            startDate: true,
            sponsorName: true,
            honorariumAmount: true,
            zoomSessionType: true,
          },
        },
      },
    });
    if (!reg) throw new NotFoundException('Registration not found');
    if (reg.status !== ProgramRegistrationStatus.APPROVED) {
      throw new BadRequestException('Registration must be approved first.');
    }
    if (
      reg.postEventAttendanceStatus !==
      PostEventAttendanceStatus.PENDING_VERIFICATION
    ) {
      throw new BadRequestException(
        'This registration is not waiting for attendance verification.',
      );
    }
    const next =
      status === 'VERIFIED'
        ? PostEventAttendanceStatus.VERIFIED
        : PostEventAttendanceStatus.DENIED;

    const updated = await this.prisma.programRegistration.update({
      where: { id: registrationId },
      data: {
        postEventAttendanceStatus: next,
        postEventAttendanceReviewedAt: new Date(),
        postEventAttendanceReviewedByUserId: adminUserId,
      },
    });

    if (status === 'VERIFIED') {
      await this.ensureEnrollment(reg.userId, reg.programId);
    }

    if (status === 'VERIFIED' && reg.user?.email) {
      const feedbackSurvey = await this.prisma.survey.findFirst({
        where: { programId: reg.programId, type: SurveyType.FEEDBACK },
        select: { id: true },
        orderBy: { createdAt: 'desc' },
      });

      this.sesEmail
        .sendPostWebinarSurveyEmail({
          to: reg.user.email,
          firstName: reg.user.firstName ?? '',
          program: {
            id: reg.program.id,
            title: reg.program.title,
            sponsorName: reg.program.sponsorName,
            honorariumAmount: reg.program.honorariumAmount,
            zoomSessionType:
              reg.program.zoomSessionType ?? ProgramZoomSessionType.WEBINAR,
          },
          // Native in-app survey only: CTA opens /app/surveys/:id (Surveys tab).
          surveyUrl: null,
          feedbackSurveyId: feedbackSurvey?.id ?? null,
        })
        .catch((err: Error) =>
          this.logger.warn(
            `Failed to send post-webinar survey email for registration ${registrationId}: ${err.message}`,
          ),
        );
    }

    if (status === 'DENIED' && reg.user?.email) {
      this.sesEmail
        .sendMissedWebinarEmail({
          to: reg.user.email,
          firstName: reg.user.firstName ?? '',
          program: {
            id: reg.program.id,
            title: reg.program.title,
            description: reg.program.description,
            startDate: reg.program.startDate,
            sponsorName: reg.program.sponsorName,
          },
        })
        .catch((err: Error) =>
          this.logger.warn(
            `Failed to send missed-webinar email for registration ${registrationId}: ${err.message}`,
          ),
        );
    }

    return updated;
  }

  async listPendingPostEventAttendanceForAdmin() {
    return this.listPostEventAttendanceForAdmin({
      statuses: [PostEventAttendanceStatus.PENDING_VERIFICATION],
    });
  }

  /** All approved learners with attendance tracking (pending, verified, or denied). */
  async listPostEventAttendanceForAdmin(opts?: {
    programId?: string;
    statuses?: PostEventAttendanceStatus[];
  }) {
    const statuses = opts?.statuses ?? [
      PostEventAttendanceStatus.PENDING_VERIFICATION,
      PostEventAttendanceStatus.VERIFIED,
      PostEventAttendanceStatus.DENIED,
    ];
    return this.prisma.programRegistration.findMany({
      where: {
        status: ProgramRegistrationStatus.APPROVED,
        postEventAttendanceStatus: { in: statuses },
        program: {
          zoomSessionType: { in: ['WEBINAR', 'MEETING'] },
          status: 'PUBLISHED',
          ...(opts?.programId ? { id: opts.programId } : {}),
        },
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            specialty: true,
            institution: true,
            city: true,
          },
        },
        program: {
          select: {
            id: true,
            title: true,
            zoomSessionType: true,
            startDate: true,
            zoomJoinUrl: true,
          },
        },
      },
      orderBy: [{ program: { title: 'asc' } }, { updatedAt: 'desc' }],
    });
  }

  /**
   * Registrations that are APPROVED, attendance VERIFIED, survey acknowledged,
   * and have a program honorarium, but the user has not yet requested payment.
   * Used by the admin payments panel to surface actionable follow-up items.
   */
  async listPaymentEligibleNotYetRequestedForAdmin() {
    return this.prisma.programRegistration.findMany({
      where: {
        status: ProgramRegistrationStatus.APPROVED,
        postEventAttendanceStatus: PostEventAttendanceStatus.VERIFIED,
        postEventSurveyAcknowledgedAt: { not: null },
        honorariumRequestedAt: null,
        program: {
          honorariumAmount: { gt: 0 },
          status: 'PUBLISHED',
        },
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            specialty: true,
            institution: true,
            city: true,
          },
        },
        program: {
          select: {
            id: true,
            title: true,
            honorariumAmount: true,
            zoomSessionType: true,
            startDate: true,
          },
        },
      },
      orderBy: { postEventSurveyAcknowledgedAt: 'asc' },
    });
  }

  async markCalendarInviteSent(registrationId: string) {
    return this.prisma.programRegistration.update({
      where: { id: registrationId },
      data: { calendarInviteSentAt: new Date() },
    });
  }

  buildIcsForRegistration(
    registrationId: string,
  ): Promise<{ filename: string; body: string }> {
    return this.prisma.programRegistration
      .findUnique({
        where: { id: registrationId },
        include: { program: true, user: true, slot: true },
      })
      .then((reg) => {
        if (!reg) throw new NotFoundException('Registration not found');
        if (reg.status !== ProgramRegistrationStatus.APPROVED) {
          throw new ForbiddenException(
            'Registration must be approved to generate a calendar invite',
          );
        }
        const p = reg.program;
        const start = reg.slot?.startsAt ?? p.startDate;
        const end =
          reg.slot?.endsAt ??
          (p.startDate && p.duration
            ? new Date(p.startDate.getTime() + p.duration * 60_000)
            : null);
        if (!start || !end) {
          throw new BadRequestException(
            'Program has no scheduled time; set session time or office hours slot.',
          );
        }
        const title = p.title;
        const description = [
          p.description.slice(0, 500),
          p.zoomJoinUrl ? `Join: ${p.zoomJoinUrl}` : '',
        ]
          .filter(Boolean)
          .join('\n');
        const body = buildProgramSessionIcs({
          title,
          description,
          start,
          end,
          joinUrl: p.zoomJoinUrl ?? undefined,
          uid: `reg-${reg.id}@cht`,
        });
        const safe = title.replace(/[^\w\s-]/g, '').slice(0, 40) || 'session';
        return { filename: `${safe}-invite.ics`, body };
      });
  }

  async createSlot(
    programId: string,
    dto: {
      startsAt: string;
      endsAt: string;
      label?: string;
      maxAttendees?: number;
      sortOrder?: number;
    },
  ) {
    const program = await this.prisma.program.findUnique({
      where: { id: programId },
    });
    if (!program) throw new NotFoundException('Program not found');
    return this.prisma.officeHoursSlot.create({
      data: {
        programId,
        startsAt: new Date(dto.startsAt),
        endsAt: new Date(dto.endsAt),
        label: dto.label ?? null,
        maxAttendees: dto.maxAttendees ?? 8,
        sortOrder: dto.sortOrder ?? 0,
      },
    });
  }

  async deleteSlot(slotId: string) {
    const s = await this.prisma.officeHoursSlot.findUnique({
      where: { id: slotId },
    });
    if (!s) throw new NotFoundException('Slot not found');
    await this.prisma.officeHoursSlot.delete({ where: { id: slotId } });
    return { deleted: true };
  }

  async listFormLinks(programId: string) {
    return this.prisma.programFormLink.findMany({
      where: { programId },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
  }

  async addFormLink(
    programId: string,
    dto: {
      kind: 'INTAKE' | 'PRE_EVENT' | 'POST_EVENT' | 'CUSTOM';
      label: string;
      jotformUrl: string;
      sortOrder?: number;
    },
  ) {
    return this.prisma.programFormLink.create({
      data: {
        programId,
        kind: dto.kind,
        label: dto.label,
        jotformUrl: dto.jotformUrl,
        sortOrder: dto.sortOrder ?? 0,
      },
    });
  }

  async deleteFormLink(id: string) {
    await this.prisma.programFormLink.delete({ where: { id } });
    return { deleted: true };
  }
}
