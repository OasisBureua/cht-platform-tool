import {
  WebinarParticipantEventSource,
  type Prisma,
  type PrismaClient,
} from '@prisma/client';

export type SessionAttendeeStatusInput = {
  id: string;
  programId: string | null;
  zoomMeetingId: string;
  attendanceLastImportedAt: Date | null;
  attendeeReportS3Bucket: string | null;
  attendeeReportS3Key: string | null;
  attendeeReportExportedAt: Date | null;
  attendeeReportParticipantCount: number | null;
};

export type SessionAttendeeStatusFields = {
  attendeesImported: boolean;
  attendeeImportCount: number;
  attendeeReportStoredInS3: boolean;
  attendeeReportExportedAt: string | null;
  attendeeReportParticipantCount: number | null;
  attendanceLastImportedAt: string | null;
};

export function buildSessionAttendeeStatusFields(
  session: SessionAttendeeStatusInput,
  importCount: number,
): SessionAttendeeStatusFields {
  const attendeeReportStoredInS3 = !!(
    session.attendeeReportS3Bucket && session.attendeeReportS3Key
  );
  const attendeesImported =
    session.attendanceLastImportedAt != null ||
    importCount > 0 ||
    session.attendeeReportExportedAt != null;

  return {
    attendeesImported,
    attendeeImportCount: importCount,
    attendeeReportStoredInS3,
    attendeeReportExportedAt:
      session.attendeeReportExportedAt?.toISOString() ?? null,
    attendeeReportParticipantCount:
      session.attendeeReportParticipantCount ?? null,
    attendanceLastImportedAt:
      session.attendanceLastImportedAt?.toISOString() ?? null,
  };
}

type SessionImportKey = {
  id: string;
  programId: string | null;
  zoomMeetingId: string;
};

type PrismaLike = Pick<PrismaClient, 'zoomAttendanceParticipant' | 'webinarParticipantEvent'>;

export async function loadSessionAttendeeImportCounts(
  prisma: PrismaLike,
  sessions: SessionImportKey[],
): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  if (sessions.length === 0) return counts;

  const unlinkedIds = sessions.filter((s) => !s.programId).map((s) => s.id);
  if (unlinkedIds.length > 0) {
    const staging = await prisma.zoomAttendanceParticipant.groupBy({
      by: ['sessionId'],
      where: { sessionId: { in: unlinkedIds } },
      _count: { _all: true },
    });
    for (const row of staging) {
      counts.set(row.sessionId, row._count._all);
    }
  }

  const linked = sessions.filter((s) => s.programId);
  if (linked.length > 0) {
    const orClause: Prisma.WebinarParticipantEventWhereInput[] = linked.map(
      (s) => ({
        programId: s.programId!,
        zoomMeetingId: s.zoomMeetingId,
      }),
    );
    const events = await prisma.webinarParticipantEvent.findMany({
      where: {
        source: WebinarParticipantEventSource.REPORT_IMPORT,
        event: 'JOINED',
        OR: orClause,
      },
      select: { programId: true, zoomMeetingId: true },
    });

    const eventCounts = new Map<string, number>();
    for (const e of events) {
      const key = `${e.programId}:${e.zoomMeetingId}`;
      eventCounts.set(key, (eventCounts.get(key) ?? 0) + 1);
    }

    for (const s of linked) {
      counts.set(s.id, eventCounts.get(`${s.programId}:${s.zoomMeetingId}`) ?? 0);
    }
  }

  return counts;
}
