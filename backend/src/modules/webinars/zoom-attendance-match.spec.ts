import {
  buildZoomJoinIndex,
  matchRegistrationsToZoomJoins,
  zoomPresenceForRegistration,
  resolveAttendanceFromZoomJoins,
} from './zoom-attendance-match';

describe('zoom-attendance-match', () => {
  const events = [
    { userId: 'u1', participantEmail: 'Alice@Example.com' },
    { userId: null, participantEmail: 'bob@example.com' },
    { userId: 'u3', participantEmail: null },
  ];

  it('matches by email case-insensitively only (not userId alone)', () => {
    const matches = matchRegistrationsToZoomJoins(
      [
        { id: 'r1', userId: 'u1', userEmail: 'alice@example.com' },
        { id: 'r2', userId: 'u2', userEmail: 'bob@example.com' },
        { id: 'r3', userId: 'u9', userEmail: 'nobody@example.com' },
        { id: 'r4', userId: 'u3', userEmail: 'other@example.com' },
      ],
      events,
    );

    expect(matches).toEqual([
      {
        registrationId: 'r1',
        userId: 'u1',
        matchedBy: 'email',
        zoomEmail: 'Alice@Example.com',
      },
      {
        registrationId: 'r2',
        userId: 'u2',
        matchedBy: 'email',
        zoomEmail: 'bob@example.com',
      },
    ]);
  });

  it('builds presence flags for admin UI', () => {
    expect(zoomPresenceForRegistration('u1', 'alice@example.com', events)).toEqual({
      zoomJoined: true,
      zoomParticipantEmail: 'Alice@Example.com',
    });
    expect(
      zoomPresenceForRegistration('x', 'nobody@example.com', events),
    ).toEqual({ zoomJoined: false, zoomParticipantEmail: null });
  });

  it('indexes emails and userIds from join evidence', () => {
    const index = buildZoomJoinIndex(events);
    expect(index.emails.has('alice@example.com')).toBe(true);
    expect(index.userIds.has('u1')).toBe(true);
    expect(index.userIds.has('u3')).toBe(true);
  });
});

describe('resolveAttendanceFromZoomJoins', () => {
  it('verifies when HCP email equals Zoom email', () => {
    const resolved = resolveAttendanceFromZoomJoins(
      [{ id: 'r1', userId: 'u1', userEmail: 'alice@example.com' }],
      [{ userId: 'u1', participantEmail: 'Alice@Example.com', event: 'JOINED' }],
    );
    expect(resolved).toEqual([
      {
        registrationId: 'r1',
        userId: 'u1',
        status: 'VERIFIED',
        matchedBy: 'email',
        zoomEmail: 'Alice@Example.com',
      },
    ]);
  });

  it('denies when same userId joined Zoom with a different email', () => {
    const resolved = resolveAttendanceFromZoomJoins(
      [{ id: 'r1', userId: 'u1', userEmail: 'hcp@hospital.org' }],
      [
        {
          userId: 'u1',
          participantEmail: 'personal@gmail.com',
          event: 'JOINED',
        },
      ],
    );
    expect(resolved).toEqual([
      {
        registrationId: 'r1',
        userId: 'u1',
        status: 'DENIED',
        matchedBy: 'mismatch',
        zoomEmail: 'personal@gmail.com',
      },
    ]);
  });

  it('leaves unmatched learners unresolved (stay pending)', () => {
    const resolved = resolveAttendanceFromZoomJoins(
      [{ id: 'r1', userId: 'u1', userEmail: 'hcp@hospital.org' }],
      [{ userId: 'u9', participantEmail: 'other@x.com', event: 'JOINED' }],
    );
    expect(resolved).toEqual([]);
  });
});
