import { E, emailWrap, emailButton, emailSupportLine } from './email-layout';

export type InviteSession = {
  title: string;
  startDate: Date | null;
  /** Minutes, when the program has one. */
  duration?: number | null;
};

export type RegistrationInviteTemplateInput = {
  firstName: string;
  sessions: InviteSession[];
  registerUrl: string;
  supportEmail: string;
  /** In-app participant user guide (`/app/guide`). */
  guideUrl?: string;
};

/** "Thursday, October 23 · 7:00 PM EDT", in the time zone the other session emails use. */
export function sessionWhen(start: Date | null): string | null {
  if (!start) return null;
  const tz = 'America/New_York';
  const day = new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    timeZone: tz,
  }).format(start);
  const time = new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: tz,
    timeZoneName: 'short',
  }).format(start);
  return `${day} · ${time}`;
}

const sessionFormat = (s: InviteSession) =>
  s.duration && s.duration > 0
    ? `Live on Zoom · ${s.duration} minutes`
    : 'Live on Zoom';

export function buildRegistrationInviteEmail(
  p: RegistrationInviteTemplateInput,
  escape: (s: string) => string,
): { subject: string; text: string; html: string } {
  const name = p.firstName.trim();
  const support = escape(p.supportEmail);
  const url = escape(p.registerUrl);
  const count = p.sessions.length;
  const single = count === 1;
  const subject = single
    ? `Register for: ${p.sessions[0].title}`
    : `Register for ${count} upcoming live sessions`;
  const cta = single ? 'Register for this session' : 'Choose your sessions';
  const greeting = `${name ? `Hi ${name}, you're` : "You're"} invited to join ${
    single ? 'this live session' : `${count} live sessions`
  }.`;

  const text = [
    name ? `Hi ${name},` : 'Hello,',
    '',
    single
      ? 'You are invited to join this live session on Community Health Media:'
      : 'You are invited to join these live sessions on Community Health Media:',
    '',
    ...p.sessions.flatMap((s) => [
      `• ${s.title}`,
      `  ${[sessionWhen(s.startDate), sessionFormat(s)].filter(Boolean).join(' · ')}`,
    ]),
    '',
    single
      ? 'Register here:'
      : 'Choose your sessions and complete intake (if required) here:',
    p.registerUrl,
    '',
    ...(p.guideUrl
      ? [`New to the platform? Read the participant guide: ${p.guideUrl}`, '']
      : []),
    `Questions? Reply to this email or write to ${p.supportEmail}.`,
  ].join('\n');

  const sessionBlock = (s: InviteSession, big: boolean) => {
    const when = sessionWhen(s.startDate);
    return `<p style="margin:0 0 6px;color:${E.BODY_TEXT};font-size:${big ? 26 : 16}px;line-height:${big ? 1.2 : 1.35};font-weight:${big ? 800 : 700};letter-spacing:${big ? '-0.02em' : '0'}">${escape(s.title)}</p>
        <p style="margin:0;color:${E.MUTED};font-size:${big ? 15 : 14}px;line-height:1.55">${when ? `${escape(when)}<br>` : ''}${escape(sessionFormat(s))}</p>`;
  };

  const sessionsHtml = single
    ? `<div style="margin:0 0 20px">${sessionBlock(p.sessions[0], true)}</div>`
    : `<h1 style="margin:0 0 16px;color:${E.BODY_TEXT};font-size:26px;line-height:1.2;font-weight:800;letter-spacing:-0.02em">${count} live sessions</h1>
      ${p.sessions
        .map(
          (s) =>
            `<div style="background:${E.CARD_BG};border-radius:12px;padding:16px 20px;margin:0 0 10px">${sessionBlock(s, false)}</div>`,
        )
        .join('')}
      <div style="height:10px;line-height:10px">&nbsp;</div>`;

  const body = `
      ${sessionsHtml}
      <p style="margin:0 0 24px;color:${E.MUTED};font-size:15px;line-height:1.6">${escape(greeting)} ${single ? 'Save your seat below.' : 'Pick the ones you want below.'}</p>
      ${emailButton(url, cta)}
      <p style="margin:20px 0 0;color:${E.LABEL};font-size:13px;line-height:1.55">
        Button not working? Paste this link into your browser:<br><a href="${url}" style="color:${E.LABEL};word-break:break-all">${url}</a>
      </p>
      ${
        p.guideUrl
          ? `<p style="margin:16px 0 0;color:${E.MUTED};font-size:14px;line-height:1.55">
        New to the platform? <a href="${escape(p.guideUrl)}" style="color:${E.LINK};font-weight:600">Read the participant guide</a>.
      </p>`
          : ''
      }
      ${emailSupportLine(support)}
    `;

  const html = emailWrap({
    sponsorName: 'Community Health Media',
    subtitle: "You're invited",
    body,
    hero: true,
  });

  return { subject, text, html };
}
