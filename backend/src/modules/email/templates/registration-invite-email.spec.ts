import {
  buildRegistrationInviteEmail,
  sessionWhen,
} from './registration-invite-email';
import { setEmailAssetBase } from './email-layout';
import { mailboxAddress } from '../ses-email.service';

const identity = (s: string) => s;
const start = new Date('2026-10-23T23:00:00Z'); // 7:00 PM EDT
const base = {
  firstName: 'Jane',
  sessions: [{ title: 'CHM User Test', startDate: start, duration: 60 }],
  registerUrl: 'https://app.communityhealth.media/app/live/register-multiple',
  supportEmail: 'info@communityhealth.media',
};

describe('buildRegistrationInviteEmail', () => {
  it('links the participant user guide when a guide URL is given', () => {
    const guideUrl = 'https://app.communityhealth.media/app/guide';
    const { text, html } = buildRegistrationInviteEmail(
      { ...base, guideUrl },
      identity,
    );
    expect(text).toContain(
      `New to the platform? Read the participant guide: ${guideUrl}`,
    );
    expect(html).toContain(`href="${guideUrl}"`);
  });

  it('leaves the guide line out without a guide URL', () => {
    const { text, html } = buildRegistrationInviteEmail(base, identity);
    expect(text).not.toContain('participant guide');
    expect(html).not.toContain('participant guide');
  });

  it('shows when each session is, in Eastern time, with its length', () => {
    expect(sessionWhen(start)).toBe('Friday, October 23 · 7:00 PM EDT');
    expect(sessionWhen(null)).toBeNull();
    const { text, html } = buildRegistrationInviteEmail(base, identity);
    expect(html).toContain('Friday, October 23 · 7:00 PM EDT');
    expect(html).toContain('Live on Zoom · 60 minutes');
    expect(text).toContain(
      'Friday, October 23 · 7:00 PM EDT · Live on Zoom · 60 minutes',
    );
  });

  it('asks to choose when several sessions are on offer', () => {
    const { subject, html } = buildRegistrationInviteEmail(
      {
        ...base,
        sessions: [
          ...base.sessions,
          { title: 'Second session', startDate: null, duration: null },
        ],
      },
      identity,
    );
    expect(subject).toBe('Register for 2 upcoming live sessions');
    expect(html).toContain('Choose your sessions');
    expect(html).toContain('Second session');
  });

  it('draws the CHM shell with the photo hero from the app', () => {
    setEmailAssetBase('https://app.communityhealth.media/');
    const { html } = buildRegistrationInviteEmail(base, identity);
    expect(html).toContain(
      'src="https://app.communityhealth.media/email/hero.jpg"',
    );
    expect(html).toContain(
      'src="https://app.communityhealth.media/email/chm-lockup.png"',
    );
    expect(html).toContain('href="mailto:info@communityhealth.media"');
    expect(html).not.toMatch(/#7c2d12|#ea580c/i);
  });
});

describe('mailboxAddress', () => {
  it('keeps only the address from a From header', () => {
    expect(
      mailboxAddress('"Community Health Media" <info@communityhealth.media>'),
    ).toBe('info@communityhealth.media');
    expect(mailboxAddress('info@communityhealth.media')).toBe(
      'info@communityhealth.media',
    );
  });
});
