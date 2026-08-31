/**
 * Match Zoom join evidence to CHT registrations by **email**.
 * Used after webinar.ended / meeting.ended to auto-resolve attendance.
 *
 * Rules:
 * - HCP account email == Zoom participant email → VERIFIED (Attendance Yes)
 * - Seen in Zoom under a different email (same CHT userId) → DENIED (Attendance No)
 * - Not seen in Zoom → leave PENDING
 */

export type ZoomJoinEvidence = {
  userId: string | null;
  participantEmail: string | null;
  event?: string;
  occurredAt?: Date;
};

export type RegistrationMatchCandidate = {
  id: string;
  userId: string;
  userEmail: string;
};

export type ZoomJoinMatch = {
  registrationId: string;
  userId: string;
  matchedBy: 'email';
  zoomEmail: string | null;
};

export type AttendanceResolution = {
  registrationId: string;
  userId: string;
  status: 'VERIFIED' | 'DENIED';
  matchedBy: 'email' | 'mismatch';
  zoomEmail: string | null;
};

function normEmail(email: string | null | undefined): string | null {
  const t = email?.trim().toLowerCase();
  return t || null;
}

/** Build lookup sets from JOINED WebinarParticipantEvent rows. */
export function buildZoomJoinIndex(events: ZoomJoinEvidence[]): {
  userIds: Set<string>;
  emails: Set<string>;
  /** userId → Zoom email (if any) for admin display */
  emailByUserId: Map<string, string>;
  /** normalized email → original Zoom email */
  zoomEmailByNorm: Map<string, string>;
} {
  const userIds = new Set<string>();
  const emails = new Set<string>();
  const emailByUserId = new Map<string, string>();
  const zoomEmailByNorm = new Map<string, string>();

  for (const e of events) {
    if (e.event && e.event !== 'JOINED') continue;
    const email = normEmail(e.participantEmail);
    if (email) {
      emails.add(email);
      zoomEmailByNorm.set(email, e.participantEmail!.trim());
    }
    if (e.userId) {
      userIds.add(e.userId);
      if (email && !emailByUserId.has(e.userId)) {
        emailByUserId.set(e.userId, e.participantEmail!.trim());
      }
    }
  }

  return { userIds, emails, emailByUserId, zoomEmailByNorm };
}

/** Exact email match only (HCP email present on a Zoom JOINED event). */
export function matchRegistrationsToZoomJoins(
  registrations: RegistrationMatchCandidate[],
  events: ZoomJoinEvidence[],
): ZoomJoinMatch[] {
  const index = buildZoomJoinIndex(events);
  const matches: ZoomJoinMatch[] = [];

  for (const reg of registrations) {
    const email = normEmail(reg.userEmail);
    if (email && index.emails.has(email)) {
      matches.push({
        registrationId: reg.id,
        userId: reg.userId,
        matchedBy: 'email',
        zoomEmail: index.zoomEmailByNorm.get(email) ?? null,
      });
    }
  }

  return matches;
}

/**
 * Auto attendance after session ends:
 * - email match → VERIFIED
 * - CHT user joined Zoom with a different email → DENIED
 * - otherwise omit (stay PENDING)
 */
export function resolveAttendanceFromZoomJoins(
  registrations: RegistrationMatchCandidate[],
  events: ZoomJoinEvidence[],
): AttendanceResolution[] {
  const index = buildZoomJoinIndex(events);
  const out: AttendanceResolution[] = [];

  for (const reg of registrations) {
    const hcp = normEmail(reg.userEmail);
    if (hcp && index.emails.has(hcp)) {
      out.push({
        registrationId: reg.id,
        userId: reg.userId,
        status: 'VERIFIED',
        matchedBy: 'email',
        zoomEmail: index.zoomEmailByNorm.get(hcp) ?? null,
      });
      continue;
    }

    if (!index.userIds.has(reg.userId)) {
      continue;
    }

    const zoomEmail = index.emailByUserId.get(reg.userId) ?? null;
    const zoomNorm = normEmail(zoomEmail);
    if (zoomNorm && hcp && zoomNorm !== hcp) {
      out.push({
        registrationId: reg.id,
        userId: reg.userId,
        status: 'DENIED',
        matchedBy: 'mismatch',
        zoomEmail,
      });
    }
  }

  return out;
}

/**
 * Per-registration Zoom presence for admin Program Hub.
 * "Seen in Zoom" is true when HCP email or userId appears on a JOINED event.
 */
export function zoomPresenceForRegistration(
  userId: string,
  userEmail: string,
  events: ZoomJoinEvidence[],
): { zoomJoined: boolean; zoomParticipantEmail: string | null } {
  const index = buildZoomJoinIndex(events);
  const email = normEmail(userEmail);
  if (email && index.emails.has(email)) {
    return {
      zoomJoined: true,
      zoomParticipantEmail: index.zoomEmailByNorm.get(email) ?? null,
    };
  }
  if (index.userIds.has(userId)) {
    return {
      zoomJoined: true,
      zoomParticipantEmail: index.emailByUserId.get(userId) ?? null,
    };
  }
  return { zoomJoined: false, zoomParticipantEmail: null };
}
