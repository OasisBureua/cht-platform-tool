import { buildRegistrationInviteEmail } from './registration-invite-email';

const identity = (s: string) => s;
const base = {
  firstName: 'Jane',
  programTitles: ['CHM User Test'],
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
      `New to the platform? Read the participant user guide: ${guideUrl}`,
    );
    expect(html).toContain(`href="${guideUrl}"`);
  });

  it('leaves the guide line out without a guide URL', () => {
    const { text, html } = buildRegistrationInviteEmail(base, identity);
    expect(text).not.toContain('user guide');
    expect(html).not.toContain('user guide');
  });
});
