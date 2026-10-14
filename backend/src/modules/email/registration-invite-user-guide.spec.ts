import { ConfigService } from '@nestjs/config';
import { SendEmailCommand } from '@aws-sdk/client-sesv2';
import { SesEmailService } from './ses-email.service';
import { buildEmailWithAttachmentsMimeBuffer } from './live-session-calendar';
import { buildRegistrationInviteEmail } from './templates/registration-invite-email';

const identity = (s: string) => s;

function makeService(environment: string) {
  const config = {
    get: (key: string) =>
      ({ 'aws.region': 'us-east-1', 'app.environment': environment })[key],
  } as unknown as ConfigService;
  const service = new SesEmailService(config);
  const send = jest.fn().mockResolvedValue({});
  (service as unknown as { client: { send: jest.Mock } }).client = {
    send,
  } as never;
  return { service, send };
}

const invite = {
  to: 'learner@example.com',
  firstName: 'Ada',
  programTitles: ['Lung cancer update'],
  registerUrl: 'https://devapp.communityhealth.media/join?invite=abc',
};

describe('registration invite user guide attachment', () => {
  it('builds a multipart message with the PDF as an attachment', () => {
    const raw = buildEmailWithAttachmentsMimeBuffer({
      from: 'info@communityhealth.media',
      to: 'learner@example.com',
      subject: 'Register',
      textPlain: 'hello',
      html: '<p>hello</p>',
      attachments: [
        {
          filename: 'guide.pdf',
          contentType: 'application/pdf',
          content: Buffer.from('%PDF-1.4 test'),
        },
      ],
    }).toString('utf8');

    expect(raw).toContain('Content-Type: multipart/mixed');
    expect(raw).toContain('Content-Type: application/pdf; name="guide.pdf"');
    expect(raw).toContain(
      'Content-Disposition: attachment; filename="guide.pdf"',
    );
    expect(raw).toContain(Buffer.from('%PDF-1.4 test').toString('base64'));
  });

  it('mentions the attached guide only when it is attached', () => {
    const base = { ...invite, supportEmail: 'info@communityhealth.media' };
    expect(
      buildRegistrationInviteEmail(
        { ...base, userGuideAttached: true },
        identity,
      ).text,
    ).toContain('The participant user guide is attached as a PDF.');
    expect(buildRegistrationInviteEmail(base, identity).html).not.toContain(
      'user guide',
    );
  });

  it('attaches the user guide on dev', async () => {
    const { service, send } = makeService('dev');
    await service.sendRegistrationInviteEmail(invite);

    const cmd = (send.mock.calls as SendEmailCommand[][])[0][0];
    const raw = Buffer.from(
      cmd.input.Content!.Raw!.Data as Uint8Array,
    ).toString('utf8');
    expect(raw).toContain('filename="chm-participant-user-guide.pdf"');
    expect(cmd.input.Content!.Simple).toBeUndefined();
  });

  it('sends the plain invite on production', async () => {
    const { service, send } = makeService('platform');
    await service.sendRegistrationInviteEmail(invite);

    const cmd = (send.mock.calls as SendEmailCommand[][])[0][0];
    expect(cmd.input.Content!.Raw).toBeUndefined();
    expect(cmd.input.Content!.Simple!.Body!.Text!.Data).not.toContain(
      'user guide',
    );
  });
});
