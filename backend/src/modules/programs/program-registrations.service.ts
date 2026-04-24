import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  PostEventAttendanceStatus,
  ProgramRegistrationStatus,
  ProgramStatus,
  ProgramZoomSessionType,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { effectiveWebinarIntakeFormUrl } from '../../utils/webinar-intake-url';
import { buildProgramSessionIcs } from '../../utils/ics-calendar';
import { HubSpotService } from '../hubspot/hubspot.service';
import { PaymentsService } from '../payments/payments.service';
import { SesEmailService } from '../email/ses-email.service';

@Injectable()
export class ProgramRegistrationsService {
  private readonly logger = new Logger(ProgramRegistrationsService.name);

  /** Office hours meetings use fixed 15-minute registration windows; count scales with session duration (4 per hour). */
  private static readonly OFFICE_HOURS_SEGMENT_MINUTES = 15;

  constructor(
    private prisma: PrismaService,
    private hubspot: HubSpotService,
    private config: ConfigService,
    private paymentsService: PaymentsService,
    private sesEmail: SesEmailService,
  ) {}

  /**
   * LIVE programs with honorarium, post-event Jotform, or FEEDBACK survey need attendance verification after approval.
   */
  async resolvePostEventAttendanceStatusForNewApproval(programId: string): Promise<PostEventAttendanceStatus> {
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
    const hasJotform = !!program.jotformSurveyUrl?.trim();
    const feedbackCount = await this.prisma.survey.count({
      where: { programId, type: 'FEEDBACK' },
    });
    if (hasHonorarium || hasJotform || feedbackCount > 0) {
      return PostEventAttendanceStatus.PENDING_VERIFICATION;
    }
    return PostEventAttendanceStatus.NOT_REQUIRED;
  }

  /**
   * FEEDBACK (post-event) surveys: require enrollment, the same post-time window as notifications,
   * and for live (WEBINAR/MEETING) an approved registration with attendance verified or not required.
   */
  async canUserAccessPostEventFeedbackSurvey(userId: string, programId: string): Promise<boolean> {
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
    if (!enrolled) {
      return false;
    }

    if (
      program.zoomSessionType !== ProgramZoomSessionType.WEBINAR &&
      program.zoomSessionType !== ProgramZoomSessionType.MEETING
    ) {
      return true;
    }

    const now = new Date();
    let postSurveyAllowed = false;
    if (program.zoomSessionEndedAt) {
      postSurveyAllowed = now >= program.zoomSessionEndedAt;
    } else if (program.startDate) {
      const durationMin = program.duration ?? 60;
      postSurveyAllowed = now.getTime() >= program.startDate.getTime() + durationMin * 60_000;
    } else {
      return false;
    }
    if (!postSurveyAllowed) {
      return false;
    }

    const reg = await this.prisma.programRegistration.findUnique({
      where: { userId_programId: { userId, programId } },
      select: { status: true, postEventAttendanceStatus: true },
    });
    if (!reg || reg.status !== ProgramRegistrationStatus.APPROVED) {
      return false;
    }
    if (reg.postEventAttendanceStatus === PostEventAttendanceStatus.PENDING_VERIFICATION) {
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
        throw new BadRequestException('Post-event steps unlock after the live session ends.');
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
      throw new BadRequestException('Post-event steps unlock after the scheduled session end.');
    }
  }

  /**
   * When a MEETING has a start time and duration but no rows yet, create 15-minute slots end-to-end
   * (ceil(duration/15) segments, defaulting duration to 60 if missing).
   */
  private async ensureDefaultOfficeHoursSlots(
    programId: string,
    program: { zoomSessionType: string; startDate: Date | null; duration: number | null },
  ): Promise<void> {
    if (program.zoomSessionType !== 'MEETING' || !program.startDate) return;

    const existing = await this.prisma.officeHoursSlot.count({ where: { programId } });
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
    this.logger.log(`Auto-created ${n} office-hours slot(s) for program ${programId}`);
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
        status: { in: [ProgramRegistrationStatus.PENDING, ProgramRegistrationStatus.APPROVED] },
        NOT: { officeHoursSlotId: null },
      },
      _count: { id: true },
    });
    const countBySlot = new Map(
      counts.filter((c) => c.officeHoursSlotId).map((c) => [c.officeHoursSlotId!, c._count.id]),
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
      include: { slot: true },
    });
    if (!reg) return null;

    const honorariumPayment = await this.prisma.payment.findFirst({
      where: { userId, programId, type: 'HONORARIUM' },
      orderBy: { createdAt: 'desc' },
      select: { id: true, status: true },
    });

    return {
      id: reg.id,
      status: reg.status,
      officeHoursSlotId: reg.officeHoursSlotId ?? undefined,
      intakeJotformSubmissionId: reg.intakeJotformSubmissionId ?? undefined,
      intakeJotformSubmittedAt: reg.intakeJotformSubmittedAt?.toISOString(),
      createdAt: reg.createdAt.toISOString(),
      reviewedAt: reg.reviewedAt?.toISOString(),
      postEventAttendanceStatus: reg.postEventAttendanceStatus,
      postEventSurveyAcknowledgedAt: reg.postEventSurveyAcknowledgedAt?.toISOString(),
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
    Array<{ programId: string; enrolled: boolean; registrationStatus: ProgramRegistrationStatus | null }>
  > {
    const liveProgramWhere = {
      zoomSessionType: { in: [ProgramZoomSessionType.WEBINAR, ProgramZoomSessionType.MEETING] },
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
    const map = new Map<string, { registrationStatus: ProgramRegistrationStatus | null }>();
    for (const r of regs) {
      map.set(r.programId, { registrationStatus: r.status });
    }
    for (const pid of enrollSet) {
      if (!map.has(pid)) map.set(pid, { registrationStatus: null });
    }
    return Array.from(map.entries()).map(([programId, { registrationStatus }]) => ({
      programId,
      enrolled: enrollSet.has(programId),
      registrationStatus,
    }));
  }

  /**
   * Submit or update registration. If program does not require approval, approves and enrolls immediately.
   */
  async submitRegistration(
    userId: string,
    programId: string,
    body: { officeHoursSlotId?: string; intakeJotformSubmissionId?: string },
  ) {
    const program = await this.prisma.program.findUnique({ where: { id: programId } });
    if (!program) throw new NotFoundException('Program not found');
    if (program.status !== 'PUBLISHED') {
      throw new BadRequestException('Program is not open for registration');
    }

    const existingEnrollment = await this.prisma.programEnrollment.findUnique({
      where: { userId_programId: { userId, programId } },
    });
    if (existingEnrollment) {
      throw new BadRequestException('Already enrolled in this program');
    }

    const existingRegistration = await this.prisma.programRegistration.findUnique({
      where: { userId_programId: { userId, programId } },
    });

    const slotCount = await this.prisma.officeHoursSlot.count({ where: { programId } });
    if (program.zoomSessionType === 'MEETING' && slotCount > 0 && !body.officeHoursSlotId) {
      throw new BadRequestException('Select a time slot for this office hours session');
    }

    if (body.officeHoursSlotId) {
      const slot = await this.prisma.officeHoursSlot.findFirst({
        where: { id: body.officeHoursSlotId, programId },
      });
      if (!slot) throw new BadRequestException('Invalid time slot');
      const used = await this.prisma.programRegistration.count({
        where: {
          officeHoursSlotId: slot.id,
          status: { in: [ProgramRegistrationStatus.PENDING, ProgramRegistrationStatus.APPROVED] },
        },
      });
      if (used >= slot.maxAttendees) {
        throw new BadRequestException('This time slot is full');
      }
    }

    const requiresApproval = program.registrationRequiresApproval;
    const status = requiresApproval
      ? ProgramRegistrationStatus.PENDING
      : ProgramRegistrationStatus.APPROVED;

    const becomesApproved =
      status === ProgramRegistrationStatus.APPROVED &&
      existingRegistration?.status !== ProgramRegistrationStatus.APPROVED;

    const intakeSid = body.intakeJotformSubmissionId?.trim();
    const incomingIntakeDefined = body.intakeJotformSubmissionId !== undefined;
    const mergedIntakeId = incomingIntakeDefined
      ? intakeSid || null
      : existingRegistration?.intakeJotformSubmissionId ?? null;

    const reg = await this.prisma.programRegistration.upsert({
      where: { userId_programId: { userId, programId } },
      create: {
        userId,
        programId,
        status,
        postEventAttendanceStatus:
          status === ProgramRegistrationStatus.APPROVED
            ? await this.resolvePostEventAttendanceStatusForNewApproval(programId)
            : PostEventAttendanceStatus.NOT_REQUIRED,
        officeHoursSlotId: body.officeHoursSlotId ?? null,
        intakeJotformSubmissionId: intakeSid || null,
        intakeJotformSubmittedAt: intakeSid ? new Date() : null,
      },
      update: {
        status,
        ...(status === ProgramRegistrationStatus.PENDING
          ? { postEventAttendanceStatus: PostEventAttendanceStatus.NOT_REQUIRED }
          : becomesApproved
            ? {
                postEventAttendanceStatus:
                  await this.resolvePostEventAttendanceStatusForNewApproval(programId),
              }
            : {}),
        officeHoursSlotId: body.officeHoursSlotId ?? undefined,
        ...(incomingIntakeDefined ? { intakeJotformSubmissionId: intakeSid || null } : {}),
        /** Refresh whenever they submit again and an intake id is on file (body or existing). */
        intakeJotformSubmittedAt: mergedIntakeId ? new Date() : null,
        updatedAt: new Date(),
        // Fresh pending request after rejection — clear last review so admins see a new queue item.
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
      this.hubspot
        .createOrUpdateContact({
          email: user.email,
          firstname: user.firstName,
          lastname: user.lastName,
          jobtitle: user.specialty ?? undefined,
          company: user.institution ?? undefined,
        })
        .catch(() => {});
    }

    this.logger.log(
      `Registration ${reg.id} for program ${programId} user ${userId} status=${status}`,
    );

    return {
      id: reg.id,
      status: reg.status,
      enrolled: !requiresApproval,
    };
  }

  /**
   * Jotform webhook: published webinar intake submitted — persist submission id and optionally enroll.
   */
  async recordWebinarIntakeFromJotformWebhook(
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
      this.logger.warn(`Intake webhook: program ${programId} is not a published WEBINAR/MEETING session`);
      return false;
    }
    const intakeEffective = effectiveWebinarIntakeFormUrl(
      program.zoomSessionType,
      program.jotformIntakeFormUrl,
      this.config.get<string>('jotform.webinarDefaultIntakeUrl')?.trim() || undefined,
    );
    if (!intakeEffective) {
      this.logger.warn(`Intake webhook: program ${programId} has no intake URL configured`);
      return false;
    }

    const enrolled = await this.prisma.programEnrollment.findUnique({
      where: { userId_programId: { userId, programId } },
    });
    if (enrolled) {
      const att = await this.resolvePostEventAttendanceStatusForNewApproval(programId);
      await this.prisma.programRegistration.upsert({
        where: { userId_programId: { userId, programId } },
        create: {
          userId,
          programId,
          status: ProgramRegistrationStatus.APPROVED,
          postEventAttendanceStatus: att,
          intakeJotformSubmissionId: submissionId,
          intakeJotformSubmittedAt: new Date(),
        },
        update: { intakeJotformSubmissionId: submissionId, intakeJotformSubmittedAt: new Date() },
      });
      return true;
    }

    const existing = await this.prisma.programRegistration.findUnique({
      where: { userId_programId: { userId, programId } },
    });

    if (existing?.status === ProgramRegistrationStatus.APPROVED) {
      await this.prisma.programRegistration.update({
        where: { id: existing.id },
        data: { intakeJotformSubmissionId: submissionId, intakeJotformSubmittedAt: new Date() },
      });
      await this.ensureEnrollment(userId, programId);
      return true;
    }

    const requiresApproval = program.registrationRequiresApproval;
    const approvedNow = !requiresApproval;
    const attendanceIfApproved = await this.resolvePostEventAttendanceStatusForNewApproval(programId);

    if (!existing) {
      await this.prisma.programRegistration.create({
        data: {
          userId,
          programId,
          status: approvedNow
            ? ProgramRegistrationStatus.APPROVED
            : ProgramRegistrationStatus.PENDING,
          postEventAttendanceStatus: approvedNow
            ? attendanceIfApproved
            : PostEventAttendanceStatus.NOT_REQUIRED,
          intakeJotformSubmissionId: submissionId,
          intakeJotformSubmittedAt: new Date(),
        },
      });
    } else {
      const nextStatus =
        approvedNow
          ? ProgramRegistrationStatus.APPROVED
          : existing.status === ProgramRegistrationStatus.REJECTED
            ? ProgramRegistrationStatus.PENDING
            : existing.status;
      const becomesApprovedHere = nextStatus === ProgramRegistrationStatus.APPROVED;
      await this.prisma.programRegistration.update({
        where: { id: existing.id },
        data: {
          intakeJotformSubmissionId: submissionId,
          intakeJotformSubmittedAt: new Date(),
          status: nextStatus,
          ...(nextStatus === ProgramRegistrationStatus.PENDING
            ? { postEventAttendanceStatus: PostEventAttendanceStatus.NOT_REQUIRED }
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
      this.hubspot
        .createOrUpdateContact({
          email: user.email,
          firstname: user.firstName,
          lastname: user.lastName,
          jobtitle: user.specialty ?? undefined,
          company: user.institution ?? undefined,
        })
        .catch(() => {});
    }

    this.logger.log(
      `Intake webhook: user ${userId} program ${programId} submission ${submissionId} approvedNow=${approvedNow}`,
    );
    return true;
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
        user: { select: { id: true, email: true, firstName: true, lastName: true, specialty: true } },
        slot: true,
        program: { select: { jotformIntakeFormUrl: true, zoomSessionType: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
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
      /** Resubmits after rejection bump updatedAt — sort by that so queue order matches “last touch”. */
      orderBy: { updatedAt: 'asc' },
    });
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
        ? await this.resolvePostEventAttendanceStatusForNewApproval(reg.programId)
        : PostEventAttendanceStatus.NOT_REQUIRED;

    const normalizedNotes =
      adminNotes === undefined
        ? undefined
        : adminNotes === null || (typeof adminNotes === 'string' && adminNotes.trim() === '')
          ? null
          : String(adminNotes).trim().slice(0, 8000);

    const updated = await this.prisma.$transaction(async (tx) => {
      const row = await tx.programRegistration.update({
        where: { id: registrationId },
        data: {
          status,
          postEventAttendanceStatus: nextAttendance,
          adminNotes: normalizedNotes !== undefined ? normalizedNotes : undefined,
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
        },
      });

      if (status === ProgramRegistrationStatus.APPROVED) {
        await tx.programEnrollment.upsert({
          where: { userId_programId: { userId: reg.userId, programId: reg.programId } },
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
          select: { email: true, firstName: true },
        });
        if (!u?.email) {
          return;
        }
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
          },
          sessionKind: reg.program.zoomSessionType!,
        });
      })().catch((e: Error) => this.logger.warn(`Registration-approved email side effect: ${e.message}`));
    }

    if (
      status === ProgramRegistrationStatus.REJECTED &&
      previousStatus !== ProgramRegistrationStatus.REJECTED &&
      (reg.program.zoomSessionType === ProgramZoomSessionType.WEBINAR ||
        reg.program.zoomSessionType === ProgramZoomSessionType.MEETING)
    ) {
      const rejectReason = emailOpts?.rejectEmailReason === 'INCOMPLETE_INTAKE' ? 'INCOMPLETE_INTAKE' : 'GENERIC';
      const noteForEmail = (normalizedNotes ?? '').toString().trim().slice(0, 2000);
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
          sessionKind: reg.program.zoomSessionType!,
          reason: rejectReason,
          adminNote: noteForEmail,
        });
      })().catch((e: Error) => this.logger.warn(`Registration-rejected email side effect: ${e.message}`));
    }

    return updated;
  }

  /**
   * Remove a user's enrollment from a program and mark their registration rejected so they may register again.
   */
  async adminRemoveEnrollment(adminUserId: string, programId: string, enrollmentId: string) {
    const enrollment = await this.prisma.programEnrollment.findUnique({
      where: { id: enrollmentId },
    });
    if (!enrollment || enrollment.programId !== programId) {
      throw new NotFoundException('Enrollment not found');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.programEnrollment.delete({ where: { id: enrollmentId } });
      const reg = await tx.programRegistration.findUnique({
        where: { userId_programId: { userId: enrollment.userId, programId: enrollment.programId } },
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
            adminNotes: 'Enrollment removed by admin; learner may register again.',
          },
        });
      }
    });

    this.logger.log(`Admin ${adminUserId} removed enrollment ${enrollmentId} (program ${programId})`);
    return { removed: true };
  }

  async acknowledgePostEventSurvey(userId: string, programId: string) {
    const program = await this.prisma.program.findUnique({
      where: { id: programId },
      select: {
        jotformSurveyUrl: true,
        honorariumAmount: true,
        zoomSessionType: true,
        startDate: true,
        duration: true,
        zoomSessionEndedAt: true,
      },
    });
    if (!program) throw new NotFoundException('Program not found');
    if (!program.jotformSurveyUrl?.trim()) {
      throw new BadRequestException('This program does not have a post-event survey URL.');
    }
    this.assertProgramPostEventWindowOpen(program);

    const reg = await this.prisma.programRegistration.findUnique({
      where: { userId_programId: { userId, programId } },
    });
    if (!reg || reg.status !== ProgramRegistrationStatus.APPROVED) {
      throw new ForbiddenException('Your registration must be approved.');
    }
    if (reg.postEventAttendanceStatus === PostEventAttendanceStatus.PENDING_VERIFICATION) {
      throw new BadRequestException(
        'An administrator must confirm your attendance before you can complete the post-event survey.',
      );
    }
    if (reg.postEventAttendanceStatus === PostEventAttendanceStatus.DENIED) {
      throw new ForbiddenException('Attendance was not verified for this session.');
    }

    const hasHonor = program.honorariumAmount != null && program.honorariumAmount > 0;
    if (hasHonor) {
      await this.paymentsService.ensurePendingHonorariumForProgram(userId, programId);
    }

    return this.prisma.programRegistration.update({
      where: { id: reg.id },
      data: {
        postEventSurveyAcknowledgedAt: new Date(),
        ...(hasHonor ? { honorariumRequestedAt: new Date() } : {}),
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
      throw new BadRequestException('This program does not include an honorarium.');
    }

    this.assertProgramPostEventWindowOpen(program);

    const reg = await this.prisma.programRegistration.findUnique({
      where: { userId_programId: { userId, programId } },
    });
    if (!reg || reg.status !== ProgramRegistrationStatus.APPROVED) {
      throw new ForbiddenException('Your registration must be approved.');
    }
    if (reg.postEventAttendanceStatus === PostEventAttendanceStatus.PENDING_VERIFICATION) {
      throw new BadRequestException('Attendance must be verified before requesting payment.');
    }
    if (reg.postEventAttendanceStatus === PostEventAttendanceStatus.DENIED) {
      throw new ForbiddenException('Attendance was not verified for this session.');
    }

    if (reg.honorariumRequestedAt) {
      const result = await this.paymentsService.ensurePendingHonorariumForProgram(userId, programId);
      return { ...result, alreadyRequested: true as const };
    }

    if (program.jotformSurveyUrl?.trim() && !reg.postEventSurveyAcknowledgedAt) {
      throw new BadRequestException('Complete and acknowledge the post-event survey first.');
    }

    const u = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { billVendorId: true, w9Submitted: true },
    });
    if (!u?.billVendorId) {
      throw new BadRequestException('Add your payment profile under Payments before requesting an honorarium.');
    }
    if (!u.w9Submitted) {
      throw new BadRequestException('Submit your W-9 under Payments before requesting an honorarium.');
    }

    const result = await this.paymentsService.ensurePendingHonorariumForProgram(userId, programId);

    await this.prisma.programRegistration.update({
      where: { id: reg.id },
      data: { honorariumRequestedAt: new Date() },
    });

    return result;
  }

  async adminSetPostEventAttendance(
    adminUserId: string,
    registrationId: string,
    status: 'VERIFIED' | 'DENIED',
  ) {
    if (status !== 'VERIFIED' && status !== 'DENIED') {
      throw new BadRequestException('status must be VERIFIED or DENIED');
    }
    const reg = await this.prisma.programRegistration.findUnique({ where: { id: registrationId } });
    if (!reg) throw new NotFoundException('Registration not found');
    if (reg.status !== ProgramRegistrationStatus.APPROVED) {
      throw new BadRequestException('Registration must be approved first.');
    }
    if (reg.postEventAttendanceStatus !== PostEventAttendanceStatus.PENDING_VERIFICATION) {
      throw new BadRequestException('This registration is not waiting for attendance verification.');
    }
    const next =
      status === 'VERIFIED'
        ? PostEventAttendanceStatus.VERIFIED
        : PostEventAttendanceStatus.DENIED;

    return this.prisma.programRegistration.update({
      where: { id: registrationId },
      data: {
        postEventAttendanceStatus: next,
        postEventAttendanceReviewedAt: new Date(),
        postEventAttendanceReviewedByUserId: adminUserId,
      },
    });
  }

  async listPendingPostEventAttendanceForAdmin() {
    return this.prisma.programRegistration.findMany({
      where: {
        status: ProgramRegistrationStatus.APPROVED,
        postEventAttendanceStatus: PostEventAttendanceStatus.PENDING_VERIFICATION,
        program: {
          zoomSessionType: { in: ['WEBINAR', 'MEETING'] },
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
            zoomSessionType: true,
            startDate: true,
            zoomJoinUrl: true,
          },
        },
      },
      orderBy: { updatedAt: 'asc' },
    });
  }

  async markCalendarInviteSent(registrationId: string) {
    return this.prisma.programRegistration.update({
      where: { id: registrationId },
      data: { calendarInviteSentAt: new Date() },
    });
  }

  buildIcsForRegistration(registrationId: string): Promise<{ filename: string; body: string }> {
    return this.prisma.programRegistration
      .findUnique({
        where: { id: registrationId },
        include: { program: true, user: true, slot: true },
      })
      .then((reg) => {
        if (!reg) throw new NotFoundException('Registration not found');
        if (reg.status !== ProgramRegistrationStatus.APPROVED) {
          throw new ForbiddenException('Registration must be approved to generate a calendar invite');
        }
        const p = reg.program;
        const start = reg.slot?.startsAt ?? p.startDate;
        const end = reg.slot?.endsAt ?? (p.startDate && p.duration ? new Date(p.startDate.getTime() + p.duration * 60_000) : null);
        if (!start || !end) {
          throw new BadRequestException('Program has no scheduled time; set session time or office hours slot.');
        }
        const title = p.title;
        const description = [p.description.slice(0, 500), p.zoomJoinUrl ? `Join: ${p.zoomJoinUrl}` : '']
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
    dto: { startsAt: string; endsAt: string; label?: string; maxAttendees?: number; sortOrder?: number },
  ) {
    const program = await this.prisma.program.findUnique({ where: { id: programId } });
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
    const s = await this.prisma.officeHoursSlot.findUnique({ where: { id: slotId } });
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
    dto: { kind: 'INTAKE' | 'PRE_EVENT' | 'POST_EVENT' | 'CUSTOM'; label: string; jotformUrl: string; sortOrder?: number },
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
