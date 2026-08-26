/**
 * Match Zoom join evidence to CHT registrations (email / userId).
 * Used after webinar.ended / meeting.ended to auto-verify attendance.
 */

export type ZoomJoinEvidence = {
  userId: string | null;
  participantEmail: string | null;
};

export type RegistrationMatchCandidate = {
  id: string;
  userId: string;
  userEmail: string;
};

export type ZoomJoinMatch = {
  registrationId: string;
  userId: string;
  matchedBy: 'userId' | 'email';
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

export function matchRegistrationsToZoomJoins(
  registrations: RegistrationMatchCandidate[],
  events: ZoomJoinEvidence[],
): ZoomJoinMatch[] {
  const index = buildZoomJoinIndex(events);
  const matches: ZoomJoinMatch[] = [];

  for (const reg of registrations) {
    if (index.userIds.has(reg.userId)) {
      matches.push({
        registrationId: reg.id,
        userId: reg.userId,
        matchedBy: 'userId',
        zoomEmail: index.emailByUserId.get(reg.userId) ?? null,
      });
      continue;
    }
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

/** Per-registration Zoom presence for admin Program Hub. */
export function zoomPresenceForRegistration(
  userId: string,
  userEmail: string,
  events: ZoomJoinEvidence[],
): { zoomJoined: boolean; zoomParticipantEmail: string | null } {
  const index = buildZoomJoinIndex(events);
  if (index.userIds.has(userId)) {
    return {
      zoomJoined: true,
      zoomParticipantEmail: index.emailByUserId.get(userId) ?? null,
    };
  }
  const email = normEmail(userEmail);
  if (email && index.emails.has(email)) {
    return {
      zoomJoined: true,
      zoomParticipantEmail: index.zoomEmailByNorm.get(email) ?? null,
    };
  }
  return { zoomJoined: false, zoomParticipantEmail: null };
}
