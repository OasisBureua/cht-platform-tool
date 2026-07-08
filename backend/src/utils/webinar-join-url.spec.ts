import {
  attendeeJoinUrl,
  learnerWebinarJoinUrl,
  panelistJoinUrlForEmail,
} from './webinar-join-url';

describe('webinar-join-url', () => {
  describe('attendeeJoinUrl', () => {
    it('returns trimmed attendee URL', () => {
      expect(attendeeJoinUrl('  https://zoom.us/j/123  ')).toBe(
        'https://zoom.us/j/123',
      );
    });

    it('returns null for empty values', () => {
      expect(attendeeJoinUrl(null)).toBeNull();
      expect(attendeeJoinUrl(undefined)).toBeNull();
      expect(attendeeJoinUrl('   ')).toBeNull();
    });
  });

  describe('learnerWebinarJoinUrl', () => {
    it('always uses the shared attendee link', () => {
      const attendee = 'https://zoom.us/j/attendee';
      const panelists = [
        {
          email: 'speaker@example.com',
          joinUrl: 'https://zoom.us/w/1?tk=panelist-token',
        },
      ];
      expect(learnerWebinarJoinUrl(attendee)).toBe(attendee);
      expect(
        panelistJoinUrlForEmail(panelists, 'speaker@example.com'),
      ).toContain('tk=panelist-token');
      expect(learnerWebinarJoinUrl(attendee)).toBe(attendee);
    });
  });

  describe('panelistJoinUrlForEmail', () => {
    const links = [
      {
        name: 'Dr. Adaze',
        email: 'zsoccerguy+user1@gmail.com',
        joinUrl: 'https://zoom.us/w/81517150352?tk=token-a',
      },
      {
        name: 'CHM Staff',
        email: 'zsoccerguy@gmail.com',
        joinUrl: 'https://zoom.us/w/81517150352?tk=token-b',
      },
    ];

    it('matches panelist by email case-insensitively', () => {
      expect(
        panelistJoinUrlForEmail(links, '  ZSOCCERGUY+USER1@GMAIL.COM  '),
      ).toBe('https://zoom.us/w/81517150352?tk=token-a');
    });

    it('returns distinct URLs per panelist even when base path is shared', () => {
      const a = panelistJoinUrlForEmail(links, 'zsoccerguy@gmail.com');
      const b = panelistJoinUrlForEmail(links, 'zsoccerguy+user1@gmail.com');
      expect(a).not.toBe(b);
      expect(a).toContain('tk=token-b');
      expect(b).toContain('tk=token-a');
    });

    it('returns null when email is missing or not a panelist', () => {
      expect(panelistJoinUrlForEmail(links, null)).toBeNull();
      expect(panelistJoinUrlForEmail(links, 'unknown@example.com')).toBeNull();
      expect(panelistJoinUrlForEmail(null, 'zsoccerguy@gmail.com')).toBeNull();
    });
  });
});
