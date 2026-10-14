import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, BookOpen } from 'lucide-react';
import { cn } from '../../lib/cn';

const CARD =
  'rounded-card border border-gray-100/90 bg-card shadow-[0_1px_0_rgba(0,0,0,0.04),0_8px_28px_-12px_rgba(0,0,0,0.06)] dark:border-border';

const LINK = 'font-medium text-steel-700 underline-offset-2 hover:underline dark:text-steel-400';

const SECTIONS = [
  { id: 'account', num: '01', label: 'Account access' },
  { id: 'registration', num: '02', label: 'Live registration' },
  { id: 'approval', num: '03', label: 'Approval and emails' },
  { id: 'webinar', num: '04', label: 'Webinar day' },
  { id: 'survey', num: '05', label: 'Post-session survey' },
  { id: 'payment', num: '06', label: 'Honorarium and payment' },
  { id: 'features', num: '07', label: 'Other participant tools' },
  { id: 'troubleshooting', num: '08', label: 'Troubleshooting and support' },
] as const;

const STAGES = [
  { num: '01', label: 'Account', title: 'Sign in or create', body: 'Set up access and check required profile details.' },
  { num: '02', label: 'Registration', title: 'Sign up for Live', body: 'Choose a session, submit your request, check email.' },
  { num: '03', label: 'Approval', title: 'Wait for CHM review', body: 'Approval email includes calendar invitation and guide.' },
  { num: '04', label: 'Webinar', title: 'Join through the platform', body: 'Confirm the date and time in your calendar invite.' },
  { num: '05', label: 'Survey', title: 'Complete post-session follow-up', body: 'Survey opens after the webinar; complete within 7 days.' },
  { num: '06', label: 'Payment', title: 'Honorarium release', body: 'Amount varies; administrator releases in 1–30 days.' },
] as const;

const TROUBLESHOOTING = [
  {
    issue: 'No registration email',
    check: 'Confirm the work email used on the registration form; check spam/junk.',
    next: 'Contact CHM with the webinar title and registration date. Do not resubmit repeatedly.',
  },
  {
    issue: 'Still awaiting approval',
    check: 'Look for a registration-received email; it is not the approval email.',
    next: 'Continue monitoring email. If the registration appears stuck, contact CHM with the session title.',
  },
  {
    issue: 'Approved, but no calendar invite or guide',
    check: 'Search the inbox and spam/junk for the CHM approval email.',
    next: 'Contact the CHM team or the program contact if you still cannot find it.',
  },
  {
    issue: 'Join option missing',
    check: 'Confirm approval, correct account, webinar date/time, and that the session page is open.',
    next: 'Contact CHM or your program administrator if the join option is still unavailable at start time.',
  },
  {
    issue: 'Survey missing',
    check: 'Surveys unlock after the webinar ends. Check Surveys again afterward.',
    next: 'If it is still missing, send CHM the webinar title and date.',
  },
  {
    issue: 'Survey will not submit',
    check: 'Review the form for required questions or validation messages.',
    next: 'If it still fails, contact CHM with the exact error message—no patient information.',
  },
  {
    issue: 'Payment not released',
    check: 'Confirm survey submission and complete W-9/bank setup; allow 1–30 days.',
    next: 'After 30 days, contact CHM with program and webinar title.',
  },
] as const;

function Section({
  id,
  num,
  eyebrow,
  title,
  lede,
  children,
}: {
  id: string;
  num: string;
  eyebrow: string;
  title: string;
  lede: ReactNode;
  children: ReactNode;
}) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className={cn(CARD, 'scroll-mt-24 p-5 sm:p-7')}>
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-steel-600 dark:text-steel-400">
        {num} · {eyebrow}
      </p>
      <h2 id={`${id}-title`} className="mt-2 text-balance text-xl font-semibold text-foreground md:text-2xl">
        {title}
      </h2>
      <p className="mt-2 max-w-3xl text-pretty text-sm text-muted-foreground">{lede}</p>
      <div className="mt-6 border-t border-border pt-6">{children}</div>
    </section>
  );
}

function SubHeading({ children }: { children: ReactNode }) {
  return <h3 className="text-base font-semibold text-foreground">{children}</h3>;
}

function Steps({ items }: { items: ReactNode[] }) {
  return (
    <ol className="mt-3 space-y-2.5 text-sm text-foreground">
      {items.map((item, i) => (
        <li key={i} className="flex gap-3">
          <span className="w-5 shrink-0 text-right font-semibold tabular-nums text-steel-600 dark:text-steel-400">
            {i + 1}.
          </span>
          <span className="min-w-0 leading-relaxed">{item}</span>
        </li>
      ))}
    </ol>
  );
}

function Bullets({ items }: { items: ReactNode[] }) {
  return (
    <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-relaxed text-foreground marker:text-steel-500">
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ul>
  );
}

function Callout({ tone = 'info', children }: { tone?: 'info' | 'warn'; children: ReactNode }) {
  return (
    <div
      className={cn(
        'mt-5 rounded-[6px] border-l-[3px] px-4 py-3 text-sm leading-relaxed text-foreground',
        tone === 'warn'
          ? 'border-amber-500 bg-amber-50 dark:bg-amber-500/10'
          : 'border-steel-500 bg-steel-50/80 dark:bg-steel-500/10',
      )}
    >
      {children}
    </div>
  );
}

/** Numbered step with a heading line, as used in Live registration. */
function StepBlock({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="border-l-[3px] border-steel-500/70 pl-4">
      <p className="text-sm font-semibold text-foreground">{title}</p>
      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{children}</p>
    </div>
  );
}

function Body({ children }: { children: ReactNode }) {
  return <div className="max-w-3xl">{children}</div>;
}

const PublicPath = ({ path }: { path: string }) => (
  <Link to={path} className={LINK}>
    app.communityhealth.media{path}
  </Link>
);

export default function UserGuide() {
  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <div className="flex items-center gap-2.5 text-foreground">
          <BookOpen className="h-5 w-5 text-steel-600 dark:text-steel-400" strokeWidth={2} aria-hidden />
          <h1 className="text-balance text-2xl font-semibold text-foreground md:text-3xl">
            Participant user guide
          </h1>
        </div>
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Participant user guide · October 2026
        </p>
        <p className="text-pretty text-lg font-semibold text-foreground">From account setup to honorarium</p>
        <p className="max-w-3xl text-pretty text-sm text-muted-foreground">
          A detailed, step-by-step guide to registering for CHM Live webinars, completing post-session
          follow-up, and understanding payment release.
        </p>
      </header>

      <section aria-labelledby="flow-title" className={cn(CARD, 'p-5 sm:p-7')}>
        <h2
          id="flow-title"
          className="text-xs font-semibold uppercase tracking-[0.14em] text-steel-600 dark:text-steel-400"
        >
          The complete participant flow
        </h2>
        <p className="mt-2 text-pretty text-sm leading-relaxed text-foreground">
          Log in or create an account → register for Live → receive a registration email → wait for
          administrator approval → receive the calendar invitation and user guide → join the webinar in
          the platform → complete the survey after it ends → receive the variable program honorarium
          when an administrator releases payment (1–30 days).
        </p>

        <ol className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {STAGES.map((s) => (
            <li key={s.num} className="rounded-[6px] bg-muted/60 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-steel-600 dark:text-steel-400">
                {s.num} · {s.label}
              </p>
              <p className="mt-1.5 text-sm font-semibold text-foreground">{s.title}</p>
              <p className="mt-1 text-sm text-muted-foreground">{s.body}</p>
            </li>
          ))}
        </ol>

        <div className="mt-6 grid gap-6 md:grid-cols-2">
          <div>
            <h3 className="text-sm font-semibold text-foreground">How to use this guide</h3>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              Follow the sections in order the first time.
            </p>
          </div>
          <nav aria-label="Guide contents">
            <h3 className="text-sm font-semibold text-foreground">Contents</h3>
            <ol className="mt-1 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
              {SECTIONS.map((s) => (
                <li key={s.id}>
                  <a href={`#${s.id}`} className={LINK}>
                    {s.num} {s.label}
                  </a>
                </li>
              ))}
            </ol>
          </nav>
        </div>

        <p className="mt-6 text-xs text-muted-foreground">
          The webinar is recorded. Follow program-specific directions from CHM. Educational content is
          not medical advice and does not replace professional clinical judgment.
        </p>
      </section>

      <Section
        id="account"
        num="01"
        eyebrow="Account access"
        title="Sign in or create your account"
        lede="Use the account you will use for webinar registration and participant tools. Keep access to the work email address you enter."
      >
        <Body>
          <SubHeading>Already have an account</SubHeading>
          <Steps
            items={[
              <>
                Open <PublicPath path="/login" />.
              </>,
              'Enter the email address and password associated with your CHM account, or use Google sign-in if that is how you registered.',
              'Select the sign-in control shown on the page and wait for the participant area to load.',
              <>
                If you cannot remember the password, select <strong>Forgot password?</strong>, enter the
                account email, choose <strong>Send reset link</strong>, then follow the reset-code
                instructions.
              </>,
            ]}
          />
          <p className="mt-4 text-sm text-muted-foreground">
            <strong className="text-foreground">Expected:</strong> the participant area opens with
            navigation such as Dashboard, Live, Office Hrs, Conversations, Podcasts, Surveys, KOL Network,
            and Earnings.
          </p>
        </Body>

        <div className="mt-8 border-t border-border pt-6">
          <Body>
            <SubHeading>New to CHM</SubHeading>
            <Steps
              items={[
                <>
                  Open <PublicPath path="/join" />.
                </>,
                <>
                  Choose <strong>Continue with Google</strong>, or use the email form.
                </>,
                'Complete the required fields: First name, Last name, Work email, Mobile phone (U.S. number), Password, Role, State, and 5-digit ZIP code.',
                'Institution / Hospital and City are optional. Choose the role that best describes your professional background.',
                'Create a password with at least 8 characters, an uppercase and a lowercase letter, a number, and a symbol.',
                'Submit the account form, then follow the on-screen confirmation prompt before continuing.',
              ]}
            />
            <Callout>
              <strong>Keep details consistent.</strong> Use the same account for Live registration and
              later participant tools. Never enter patient-identifying information into profile fields.
            </Callout>
          </Body>
        </div>
      </Section>

      <Section
        id="registration"
        num="02"
        eyebrow="Live registration"
        title="Find a webinar and submit your registration"
        lede="Creating an account does not register you for a webinar. Sign up for each Live session you want to attend."
      >
        <Body>
          <div className="space-y-4">
            <StepBlock title="1 · Open Live">
              After signing in, locate <strong className="text-foreground">Live</strong> in the participant
              navigation and select it.
            </StepBlock>
            <StepBlock title="2 · Review upcoming sessions">
              Scan the Live page for the program you want. Check the session title, date, time,
              description, and registration status before opening it.
            </StepBlock>
            <StepBlock title="3 · Open an available session">
              Choose a session marked <strong className="text-foreground">Registration open</strong>.
              Review the full session details before registering. The Live page may also show{' '}
              <strong className="text-foreground">Register for the next session</strong>.
            </StepBlock>
            <StepBlock title="4 · Complete the registration prompt">
              Follow the prompts on the session page. If asked what you are stuck on, share a concise
              clinical question or topic for faculty. Keep the case general—do not include names, dates
              of birth, record numbers, or other identifying details.
            </StepBlock>
            <StepBlock title="5 · Submit once and check email">
              Submit the registration request. Check the work-email inbox for CHM’s registration email.
              This confirms receipt; it does not mean approval is complete.
            </StepBlock>
          </div>
        </Body>
        <Callout>
          <strong>Before you submit:</strong> confirm the session date and time. If a registration email
          does not appear, check spam/junk and make sure you used the correct work email. Do not create a
          second request while the first may be under review.
        </Callout>
      </Section>

      <Section
        id="approval"
        num="03"
        eyebrow="Registration approval"
        title="Understand the two emails"
        lede="Registration receipt and administrator approval are separate steps. Do not treat the first email as a confirmed seat."
      >
        <Body>
          <SubHeading>Platform registration</SubHeading>
          <Steps
            items={[
              <>
                <strong>Registration email:</strong> after you submit the platform form, CHM sends a
                registration email. It confirms that your request was received.
              </>,
              <>
                <strong>Approval review:</strong> wait for an administrator to review the request. Keep
                checking the inbox and spam/junk folder for the address on your CHM account.
              </>,
              <>
                <strong>Approval email:</strong> if approved, CHM sends another email with a calendar
                invitation and the participant user guide.
              </>,
              <>
                <strong>Save both:</strong> accept or save the calendar invitation so the session date and
                time are easy to find. Keep the guide available for the webinar.
              </>,
            ]}
          />
          <Callout tone="warn">
            <strong>Still waiting?</strong> If you are unsure whether your request was received, search for
            the registration email first. If you need help, contact CHM with the session title and the
            email used to register.
          </Callout>
        </Body>

        <div className="mt-8 border-t border-border pt-6">
          <Body>
            <SubHeading>Calendar invitation, guide, and direct team invitation</SubHeading>
            <div className="mt-3 space-y-4">
              <StepBlock title="Approved through the platform">
                Open the approval email. Save the calendar invitation and review the attached or linked
                participant guide. Use the invitation to verify the start time.
              </StepBlock>
              <StepBlock title="Registration email from the CHM team">
                Some participants receive registration details directly from the CHM team instead of
                starting in the platform. Follow that message’s instructions; use the CHM platform to join
                the webinar as directed.
              </StepBlock>
            </div>
          </Body>
        </div>
      </Section>

      <Section
        id="webinar"
        num="04"
        eyebrow="Webinar day"
        title="Join the webinar through CHM"
        lede="Use the platform—not a guessed or forwarded link—to open the webinar associated with your registration."
      >
        <Body>
          <SubHeading>Before the start time</SubHeading>
          <Steps
            items={[
              'Open your saved calendar invitation and confirm the date, time, and time zone.',
              <>
                Sign in to <PublicPath path="/login" /> with the same CHM account used to register.
              </>,
              <>
                Choose <strong>Live</strong> in the participant navigation and locate the webinar you were
                approved to attend.
              </>,
              'Open the event page and verify that the session title and start time match the invitation.',
              'At the scheduled time, choose the join control displayed on the session page. The exact label can vary by session; use the join option shown in your platform.',
            ]}
          />
          <div className="mt-6">
            <SubHeading>During and after</SubHeading>
            <Bullets
              items={[
                'Follow any program-specific directions from CHM or the moderator.',
                'The webinar is recorded. Recording access or replay availability depends on the program; follow the instructions you receive rather than assuming a replay link.',
                <>
                  After the webinar ends, proceed to <strong>Surveys</strong> for the post-session
                  follow-up.
                </>,
              ]}
            />
          </div>
        </Body>
        <Callout>
          <strong>If the join option is missing:</strong> confirm approval, the session date/time, and that
          you are signed into the correct account. See{' '}
          <a href="#troubleshooting" className={LINK}>
            Troubleshooting
          </a>
          .
        </Callout>
      </Section>

      <Section
        id="survey"
        num="05"
        eyebrow="Post-session survey"
        title="Complete the survey after the webinar"
        lede="The participant screen says surveys unlock after the Live session ends and advises completing them within seven days to receive the honorarium."
      >
        <Body>
          <Steps
            items={[
              <>
                In the participant navigation, select <Link to="/app/surveys" className={LINK}>Surveys</Link>.
              </>,
              'After your webinar ends, find the matching post-event survey. It may not appear before the session has ended.',
              'Open the survey card. Confirm the session/program shown is the one you attended.',
              'Answer the survey questions and complete all required items shown by the form. Submit within seven days.',
              <>
                Return to Surveys. For a completed item, select <strong>View submission</strong> to review
                your response.
              </>,
            ]}
          />
          <Callout>
            <strong>Survey not listed?</strong> Refresh or revisit Surveys after the event ends. If it
            remains missing, contact CHM with the webinar title and date.
          </Callout>
          <Callout>
            <strong>After submission:</strong> confirm that the survey appears as completed. Use{' '}
            <strong>View submission</strong> if you want to review what you sent. Keep your Payment
            Settings current so CHM can process an eligible honorarium.
          </Callout>
        </Body>
      </Section>

      <Section
        id="payment"
        num="06"
        eyebrow="Honorarium and payment"
        title="Track payment release"
        lede="Completing the post-session survey awards the program honorarium. Amounts vary by program; this guide intentionally shows no payout amounts."
      >
        <ol className="mb-6 grid gap-2 text-center text-sm font-semibold text-foreground sm:grid-cols-[1fr_auto_1fr_auto_1fr] sm:items-center">
          <li className="rounded-[6px] bg-muted/60 px-4 py-3">Survey submitted</li>
          <li aria-hidden className="hidden text-muted-foreground sm:block">→</li>
          <li className="rounded-[6px] bg-muted/60 px-4 py-3">Honorarium awarded</li>
          <li aria-hidden className="hidden text-muted-foreground sm:block">→</li>
          <li className="rounded-[6px] bg-muted/60 px-4 py-3">Admin releases payment within 1–30 days</li>
        </ol>
        <Body>
          <SubHeading>Set up or confirm Payment Settings</SubHeading>
          <Steps
            items={[
              <>
                From the participant navigation, open{' '}
                <Link to="/app/earnings" className={LINK}>
                  Earnings
                </Link>
                .
              </>,
              <>
                Choose{' '}
                <Link to="/app/settings" state={{ settingsTab: 'payment' as const }} className={LINK}>
                  Payment Settings
                </Link>{' '}
                to connect or update payment details.
              </>,
              'Complete the required tax information, including your W-9, and connect your bank account.',
              'Check that the setup is complete. CHM indicates payouts are sent through Stripe by ACH once bank and tax details are connected.',
              'After the survey, allow the CHM administrator 1–30 days to release payment. The timing is managed by the CHM team; participants do not release the payment themselves.',
              <>
                Use <strong>Earnings</strong> to review payout status and payment activity.
              </>,
            ]}
          />
          <Callout tone="warn">
            <strong>Protect financial information.</strong> Never send bank details, tax identifiers, or
            passwords in a support message.
          </Callout>
        </Body>
        <div className="mt-6 rounded-[6px] border border-border bg-muted/40 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-steel-600 dark:text-steel-400">
            If payment has not been released
          </p>
          <p className="mt-1.5 text-sm leading-relaxed text-foreground">
            First confirm the survey is submitted and Payment Settings are complete. Allow the full
            1–30-day administrator release window. If 30 days have passed, contact CHM with the program and
            webinar title.
          </p>
        </div>
      </Section>

      <Section
        id="features"
        num="07"
        eyebrow="Other participant features"
        title="Explore the rest of the platform"
        lede="These areas appear in the participant navigation. Some content is available only when CHM has scheduled or published it."
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(
            [
              ['Dashboard', '/app/home', 'Return to your participant home area and review available program activity.'],
              ['Office Hrs', '/app/office-hours', 'Open Office Hrs and review scheduled times. If none are listed, check again when new sessions are announced.'],
              [
                'Conversations',
                '/app/catalog',
                <>
                  Search sessions, trials, or faculty; use faculty browsing, then choose{' '}
                  <strong className="text-foreground">Play</strong> or{' '}
                  <strong className="text-foreground">More detail</strong>.
                </>,
              ],
              [
                'Podcasts',
                '/app/podcast-network',
                <>
                  Choose <strong className="text-foreground">Play the latest episode</strong> or{' '}
                  <strong className="text-foreground">Browse the KOL directory</strong>.
                </>,
              ],
              ['KOL Network', '/app/kols', 'Browse the available faculty and expert directory.'],
              [
                'Program hub time slots',
                null,
                'If your program provides a separate hub link, open it, compare the displayed date/time with your availability, then follow its booking prompts. Contact the program team if the link or slots are missing.',
              ],
            ] as const
          ).map(([title, to, body]) => (
            <StepBlock key={title} title={title}>
              {body}
              {to ? (
                <>
                  {' '}
                  <Link to={to} className={cn(LINK, 'inline-flex items-center gap-1 whitespace-nowrap')}>
                    Open <ArrowRight className="size-3.5" aria-hidden />
                  </Link>
                </>
              ) : null}
            </StepBlock>
          ))}
        </div>
      </Section>

      <Section
        id="troubleshooting"
        num="08"
        eyebrow="Troubleshooting and support"
        title="Resolve common issues"
        lede="Use the check that matches where you are in the participant flow. When contacting CHM, include the session title and date whenever possible."
      >
        <div className="overflow-x-auto rounded-[6px] border border-border">
          <table className="w-full min-w-[40rem] text-left text-sm">
            <thead className="bg-steel-900 text-xs uppercase tracking-[0.08em] text-white dark:bg-steel-800">
              <tr>
                <th scope="col" className="px-4 py-3 font-semibold">Issue</th>
                <th scope="col" className="px-4 py-3 font-semibold">What to check</th>
                <th scope="col" className="px-4 py-3 font-semibold">Next action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {TROUBLESHOOTING.map((row) => (
                <tr key={row.issue} className="align-top even:bg-muted/30">
                  <th scope="row" className="px-4 py-3 font-semibold text-foreground">{row.issue}</th>
                  <td className="px-4 py-3 text-muted-foreground">{row.check}</td>
                  <td className="px-4 py-3 text-muted-foreground">{row.next}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-6 max-w-3xl">
          <div className="rounded-[6px] bg-steel-900 p-5 text-white dark:bg-steel-800">
            <p className="text-base font-semibold">Contact CHM support</p>
            <p className="mt-2 text-sm leading-relaxed text-white/85">
              Go to{' '}
              <Link to="/app/contact" className="font-medium text-white underline underline-offset-2">
                Help &amp; support
              </Link>{' '}
              and complete the contact form. Provide your name, work email, organisation if useful, a
              short description, and the program/session title and date.
            </p>
          </div>
          <p className="mt-3 text-sm text-muted-foreground">
            Do not send passwords, patient-identifying information, bank details, or tax identifiers.
            For an urgent program-day issue, use the program contact provided in your invitation.
          </p>
        </div>
      </Section>

      <p className="text-xs text-muted-foreground">
        Public participant instructions reviewed October 13, 2026. Registration, approval, and honorarium
        eligibility may vary by program. CHM educational content is not medical advice.
      </p>
    </div>
  );
}
