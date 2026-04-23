import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ProgramRegistrationStatus, ProgramStatus, ProgramZoomSessionType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { effectiveWebinarIntakeFormUrl } from '../../utils/webinar-intake-url';
import { buildProgramSessionIcs } from '../../utils/ics-calendar';
import { HubSpotService } from '../hubspot/hubspot.service';

@Injectable()
export class ProgramRegistrationsService {
  private readonly logger = new Logger(ProgramRegistrationsService.name);

  /** Office hours meetings use fixed 15-minute registration windows; count scales with session duration (4 per hour). */
  private static readonly OFFICE_HOURS_SEGMENT_MINUTES = 15;

  constructor(
    private prisma: PrismaService,
    private hubspot: HubSpotService,
    private config: ConfigService,
  ) {}

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
    return {
      id: reg.id,
      status: reg.status,
      officeHoursSlotId: reg.officeHoursSlotId ?? undefined,
      intakeJotformSubmissionId: reg.intakeJotformSubmissionId ?? undefined,
      intakeJotformSubmittedAt: reg.intakeJotformSubmittedAt?.toISOString(),
      createdAt: reg.createdAt.toISOString(),
      reviewedAt: reg.reviewedAt?.toISOString(),
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

    const intakeSid = body.intakeJotformSubmissionId?.trim();

    const reg = await this.prisma.programRegistration.upsert({
      where: { userId_programId: { userId, programId } },
      create: {
        userId,
        programId,
        status,
        officeHoursSlotId: body.officeHoursSlotId ?? null,
        intakeJotformSubmissionId: intakeSid || null,
        intakeJotformSubmittedAt: intakeSid ? new Date() : null,
      },
      update: {
        status,
        officeHoursSlotId: body.officeHoursSlotId ?? undefined,
        ...(body.intakeJotformSubmissionId !== undefined
          ? {
              intakeJotformSubmissionId: intakeSid || null,
              intakeJotformSubmittedAt: intakeSid ? new Date() : null,
            }
          : {}),
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
      await this.prisma.programRegistration.upsert({
        where: { userId_programId: { userId, programId } },
        create: {
          userId,
          programId,
          status: ProgramRegistrationStatus.APPROVED,
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

    if (!existing) {
      await this.prisma.programRegistration.create({
        data: {
          userId,
          programId,
          status: approvedNow
            ? ProgramRegistrationStatus.APPROVED
            : ProgramRegistrationStatus.PENDING,
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
      await this.prisma.programRegistration.update({
        where: { id: existing.id },
        data: {
          intakeJotformSubmissionId: submissionId,
          intakeJotformSubmittedAt: new Date(),
          status: nextStatus,
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
        user: { select: { id: true, email: true, firstName: true, lastName: true, specialty: true } },
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
      orderBy: { createdAt: 'asc' },
    });
  }

  async adminSetRegistrationStatus(
    adminUserId: string,
    registrationId: string,
    status: ProgramRegistrationStatus,
    adminNotes?: string,
  ) {
    const reg = await this.prisma.programRegistration.findUnique({
      where: { id: registrationId },
      include: { program: true },
    });
    if (!reg) throw new NotFoundException('Registration not found');

    const updated = await this.prisma.$transaction(async (tx) => {
      const row = await tx.programRegistration.update({
        where: { id: registrationId },
        data: {
          status,
          adminNotes: adminNotes !== undefined ? adminNotes : undefined,
          reviewedAt: new Date(),
          reviewedByUserId: adminUserId,
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
