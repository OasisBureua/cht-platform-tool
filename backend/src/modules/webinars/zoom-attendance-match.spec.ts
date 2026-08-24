import {
  buildZoomJoinIndex,
  matchRegistrationsToZoomJoins,
  zoomPresenceForRegistration,
} from './zoom-attendance-match';

describe('zoom-attendance-match', () => {
  const events = [
    { userId: 'u1', participantEmail: 'Alice@Example.com' },
    { userId: null, participantEmail: 'bob@example.com' },
    { userId: 'u3', participantEmail: null },
  ];

  it('matches by userId and email case-insensitively', () => {
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
        matchedBy: 'userId',
        zoomEmail: 'Alice@Example.com',
      },
      {
        registrationId: 'r2',
        userId: 'u2',
        matchedBy: 'email',
        zoomEmail: 'bob@example.com',
      },
      {
        registrationId: 'r4',
        userId: 'u3',
        matchedBy: 'userId',
        zoomEmail: null,
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
