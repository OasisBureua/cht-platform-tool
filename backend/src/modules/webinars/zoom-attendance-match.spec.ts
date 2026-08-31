import {
  buildZoomJoinIndex,
  matchRegistrationsToZoomJoins,
  zoomPresenceForRegistration,
  attendanceDurationMs,
  matchRegistrationsToQualifiedAttendance,
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

describe('attendance duration (30 min auto-verify)', () => {
  const t = (iso: string) => new Date(iso);

  it('sums join/leave and qualifies at 30 minutes', () => {
    const timed = [
      {
        userId: 'u1',
        participantEmail: 'alice@example.com',
        event: 'JOINED',
        occurredAt: t('2026-08-31T18:00:00Z'),
      },
      {
        userId: 'u1',
        participantEmail: 'alice@example.com',
        event: 'LEFT',
        occurredAt: t('2026-08-31T18:35:00Z'),
      },
    ];
    expect(attendanceDurationMs(timed, 'u1', 'alice@example.com')).toBe(
      35 * 60 * 1000,
    );
    expect(
      matchRegistrationsToQualifiedAttendance(
        [{ id: 'r1', userId: 'u1', userEmail: 'alice@example.com' }],
        timed,
      ),
    ).toHaveLength(1);
  });

  it('does not qualify under 30 minutes', () => {
    const timed = [
      {
        userId: 'u1',
        participantEmail: 'alice@example.com',
        event: 'JOINED',
        occurredAt: t('2026-08-31T18:00:00Z'),
      },
      {
        userId: 'u1',
        participantEmail: 'alice@example.com',
        event: 'LEFT',
        occurredAt: t('2026-08-31T18:10:00Z'),
      },
    ];
    expect(
      matchRegistrationsToQualifiedAttendance(
        [{ id: 'r1', userId: 'u1', userEmail: 'alice@example.com' }],
        timed,
      ),
    ).toHaveLength(0);
  });

  it('closes an open join at session end', () => {
    const timed = [
      {
        userId: 'u1',
        participantEmail: 'alice@example.com',
        event: 'JOINED',
        occurredAt: t('2026-08-31T18:00:00Z'),
      },
    ];
    const ended = t('2026-08-31T18:40:00Z');
    expect(
      attendanceDurationMs(timed, 'u1', 'alice@example.com', ended),
    ).toBe(40 * 60 * 1000);
  });
});
