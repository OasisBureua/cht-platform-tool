import { ProgramEmailKind } from '@prisma/client';

/** Merge tokens admins may use in subject / greeting / body / sign-off. */
export const PROGRAM_EMAIL_ALLOWED_TOKENS = [
  'firstName',
  'eventTitle',
  'eventDate',
  'eventTime',
  'joinLink',
  'surveyLink',
  'sessionLink',
  'supportEmail',
  'sponsorName',
  'honorariumAmount',
] as const;

export type ProgramEmailToken = (typeof PROGRAM_EMAIL_ALLOWED_TOKENS)[number];

export type ProgramEmailCopy = {
  subject: string;
  greeting: string;
  body: string;
  signOff: string;
};

export type ProgramEmailKindMeta = {
  kind: ProgramEmailKind;
  label: string;
  description: string;
  /** Locked CTA always appended by the renderer (not editable). */
  requiredLink: 'session' | 'join' | 'survey' | 'home' | 'payments';
  defaultCopy: ProgramEmailCopy;
};

export const PROGRAM_EMAIL_KIND_META: Record<
  ProgramEmailKind,
  ProgramEmailKindMeta
> = {
  [ProgramEmailKind.REGISTRATION_RECEIVED]: {
    kind: ProgramEmailKind.REGISTRATION_RECEIVED,
    label: 'Registration received',
    description:
      'Sent when a participant finishes the registration wizard (pending or auto-enrolled).',
    requiredLink: 'session',
    defaultCopy: {
      subject: 'Registration received, {{eventTitle}}',
      greeting: 'Hi {{firstName}},',
      body: 'Thank you for registering for {{eventTitle}}.\n\nYour registration is being processed. Open the session page for details and next steps.',
      signOff: 'Best regards,\nThe Community Health Media Team',
    },
  },
  [ProgramEmailKind.REGISTRATION_APPROVED]: {
    kind: ProgramEmailKind.REGISTRATION_APPROVED,
    label: 'Approval and calendar invite',
    description:
      'Sent when registration is approved. Calendar invite (.ics) is attached separately when a start time exists.',
    requiredLink: 'join',
    defaultCopy: {
      subject: "You're approved: {{eventTitle}}",
      greeting: 'Hi {{firstName}},',
      body: 'You are approved for {{eventTitle}}{{eventDate}}.\n\nUse the join link below when it is time for the session. A calendar invite is attached when available.',
      signOff: 'See you soon,\nThe Community Health Media Team',
    },
  },
  [ProgramEmailKind.SESSION_REMINDER]: {
    kind: ProgramEmailKind.SESSION_REMINDER,
    label: 'Session reminder',
    description: 'Pre-session reminder (day-before or same-day).',
    requiredLink: 'join',
    defaultCopy: {
      subject: 'Reminder: "{{eventTitle}}" is coming up',
      greeting: 'Hi {{firstName}},',
      body: 'This is a reminder that {{eventTitle}} is coming up{{eventDate}}.\n\nJoin with the link below at the scheduled time.',
      signOff: 'Looking forward to seeing you,\nThe Community Health Media Team',
    },
  },
  [ProgramEmailKind.POST_WEBINAR_SURVEY]: {
    kind: ProgramEmailKind.POST_WEBINAR_SURVEY,
    label: 'Post-webinar survey',
    description:
      'Sent after attendance is verified. Completing the survey gates the honorarium.',
    requiredLink: 'survey',
    defaultCopy: {
      subject: 'Action required: complete your post-event survey, {{eventTitle}}',
      greeting: 'Hi {{firstName}},',
      body: 'Thank you for attending {{eventTitle}}.\n\nPlease complete the post-event survey. Your {{honorariumAmount}} honorarium is issued after the survey is completed.',
      signOff: 'Thank you,\nThe Community Health Media Team',
    },
  },
  [ProgramEmailKind.MISSED_SESSION]: {
    kind: ProgramEmailKind.MISSED_SESSION,
    label: 'Sorry we missed you',
    description:
      'Sent when a registered participant did not attend (attendance denied).',
    requiredLink: 'home',
    defaultCopy: {
      subject: 'We missed you: {{eventTitle}}',
      greeting: 'Hi {{firstName}},',
      body: 'We noticed you were registered for {{eventTitle}}{{eventDate}} but weren’t able to make it.\n\nKeep an eye out for future Community Health Media programming — we would love to see you at the next session.',
      signOff: 'Best regards,\nThe Community Health Media Team',
    },
  },
  [ProgramEmailKind.PAYMENT_FOLLOW_UP]: {
    kind: ProgramEmailKind.PAYMENT_FOLLOW_UP,
    label: 'Payment-related follow-up',
    description:
      'Follow-up about honorarium / payment setup after survey completion.',
    requiredLink: 'payments',
    defaultCopy: {
      subject: 'Next step: confirm your honorarium payout, {{eventTitle}}',
      greeting: 'Hi {{firstName}},',
      body: 'Thanks for completing the post-event survey for {{eventTitle}}.\n\nTo receive your {{honorariumAmount}} honorarium, confirm your preferred payment method in your profile.',
      signOff: 'Best regards,\nThe Community Health Media Team',
    },
  },
};

export function listProgramEmailKinds(): ProgramEmailKindMeta[] {
  return Object.values(PROGRAM_EMAIL_KIND_META);
}

export function defaultCopyFor(
  kind: ProgramEmailKind,
): ProgramEmailCopy {
  return { ...PROGRAM_EMAIL_KIND_META[kind].defaultCopy };
}

const TOKEN_RE = /\{\{\s*([a-zA-Z][a-zA-Z0-9_]*)\s*\}\}/g;

/** Extract token names used in a string (without braces). */
export function extractTokens(text: string): string[] {
  const found = new Set<string>();
  const re = new RegExp(TOKEN_RE.source, 'g');
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    found.add(m[1]);
  }
  return [...found];
}

export function findUnknownTokens(
  parts: Partial<ProgramEmailCopy>,
): string[] {
  const allowed = new Set<string>(PROGRAM_EMAIL_ALLOWED_TOKENS);
  const unknown = new Set<string>();
  for (const value of Object.values(parts)) {
    if (typeof value !== 'string') continue;
    for (const token of extractTokens(value)) {
      if (!allowed.has(token)) unknown.add(token);
    }
  }
  return [...unknown].sort();
}

export type ProgramEmailMergeContext = Partial<
  Record<ProgramEmailToken, string>
>;

/** Replace {{token}} with context values; unknown/missing → empty string. */
export function applyMergeTokens(
  template: string,
  ctx: ProgramEmailMergeContext,
): string {
  return template.replace(TOKEN_RE, (_full, name: string) => {
    const value = ctx[name as ProgramEmailToken];
    return value == null ? '' : value;
  });
}
