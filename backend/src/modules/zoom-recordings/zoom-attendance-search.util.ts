import { Prisma } from '@prisma/client';

const MAX_ATTENDANCE_SEARCH_LENGTH = 200;

/** Trim and cap attendee search input; undefined when empty. */
export function normalizeAttendanceSearchTerm(
  raw?: string | null,
): string | undefined {
  const term = raw?.trim();
  if (!term) return undefined;
  return term.slice(0, MAX_ATTENDANCE_SEARCH_LENGTH);
}

function participantFieldSearchOr(
  term: string,
): Pick<Prisma.ZoomAttendanceParticipantWhereInput, 'OR'> {
  return {
    OR: [
      { participantName: { contains: term, mode: 'insensitive' } },
      { participantEmail: { contains: term, mode: 'insensitive' } },
      { zoomParticipantId: { contains: term, mode: 'insensitive' } },
    ],
  };
}

/** Case-insensitive partial match on name, email, or Zoom participant ID. */
export function attendanceParticipantSearchWhere(
  term: string,
): Pick<Prisma.ZoomAttendanceParticipantWhereInput, 'OR'> {
  return participantFieldSearchOr(term);
}

export function buildZoomAttendanceParticipantListWhere(
  base: Prisma.ZoomAttendanceParticipantWhereInput,
  search?: string | null,
): Prisma.ZoomAttendanceParticipantWhereInput {
  const term = normalizeAttendanceSearchTerm(search);
  if (!term) return base;
  return { AND: [base, participantFieldSearchOr(term)] };
}

export function buildWebinarParticipantEventListWhere(
  base: Prisma.WebinarParticipantEventWhereInput,
  search?: string | null,
): Prisma.WebinarParticipantEventWhereInput {
  const term = normalizeAttendanceSearchTerm(search);
  if (!term) return base;
  return {
    AND: [
      base,
      {
        OR: [
          { participantName: { contains: term, mode: 'insensitive' } },
          { participantEmail: { contains: term, mode: 'insensitive' } },
          { zoomParticipantId: { contains: term, mode: 'insensitive' } },
        ],
      },
    ],
  };
}

/** Clamp page when a search narrows results below the requested page. */
export function clampAttendanceListPage(
  requestedPage: number,
  total: number,
  pageSize: number,
): number {
  if (total <= 0) return 1;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  return Math.min(Math.max(requestedPage, 1), totalPages);
}
