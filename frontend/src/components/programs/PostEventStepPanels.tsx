import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, Clock3 } from 'lucide-react';
import { format } from 'date-fns';
import type { ProgramRegistrationState } from '../../api/programs';
import { surveysApi } from '../../api/surveys';
import { listNativeSurveyQuestions } from '../../utils/survey-questions';
import { PAYOUT_WINDOW_LABEL } from '../../utils/payout-timing';

function formatAnswer(value: unknown): string {
  if (value == null) return '';
  if (Array.isArray(value)) return value.map((v) => formatAnswer(v)).filter(Boolean).join(', ');
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'object') {
    return Object.values(value as Record<string, unknown>)
      .map((v) => formatAnswer(v))
      .filter(Boolean)
      .join(', ');
  }
  return String(value).trim();
}

function shortDate(iso?: string | null) {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : format(d, 'MMM d, yyyy');
}

/** Step 1 review: attendance is recorded by the platform, nothing to edit. */
export function PostEventAttendReview({ registration }: { registration: ProgramRegistrationState }) {
  return (
    <p className="text-sm text-muted-foreground">
      {registration.postEventAttendanceStatus === 'NOT_REQUIRED'
        ? 'Attendance is not required for this session, so this step is complete.'
        : 'You attended this session. Your attendance was recorded automatically.'}
    </p>
  );
}

/** Step 1 while attendance is still being verified. */
export function PostEventAttendPending() {
  return (
    <p className="text-sm text-muted-foreground">
      Your registration is approved. After the live session, attendance is recorded automatically when the email on
      your account matches the email you used in Zoom. The survey opens as soon as that happens.
    </p>
  );
}

/** Step 2 review: read-only answers (native survey) or a recorded notice (legacy Jotform). */
export function PostEventSurveyReview(props: {
  surveyId?: string;
  hasHonorarium: boolean;
  paymentInfoConfirmed: boolean;
}) {
  const { surveyId, hasHonorarium, paymentInfoConfirmed } = props;
  const { data: survey } = useQuery({
    queryKey: ['survey', surveyId],
    queryFn: () => surveysApi.getById(surveyId!),
    enabled: Boolean(surveyId),
  });
  const { data: mine } = useQuery({
    queryKey: ['survey', surveyId, 'my-response'],
    queryFn: () => surveysApi.getMyResponse(surveyId!),
    enabled: Boolean(surveyId),
  });

  const answers = mine?.answers ?? {};
  const rows = listNativeSurveyQuestions(survey?.questions)
    .filter((q) => q.id && formatAnswer(answers[q.id]) !== '')
    .map((q) => ({ id: q.id!, prompt: q.prompt || q.id!, answer: formatAnswer(answers[q.id!]) }));

  const status = mine?.draft
    ? hasHonorarium && !paymentInfoConfirmed
      ? 'Your answers are saved. They are sent when you confirm your payment info in the next step.'
      : 'Your answers are saved.'
    : mine?.submitted
      ? `Survey submitted${shortDate(mine.submittedAt) ? ` on ${shortDate(mine.submittedAt)}` : ''}. Answers can no longer be changed.`
      : 'Your survey response is recorded.';

  return (
    <div className="space-y-3">
      <p className="inline-flex items-start gap-2 text-sm font-medium text-foreground">
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden />
        <span>{status}</span>
      </p>
      {rows.length > 0 ? (
        <dl className="divide-y divide-border rounded-[6px] border border-border bg-muted/40">
          {rows.map((row) => (
            <div key={row.id} className="px-4 py-3">
              <dt className="text-xs font-medium text-muted-foreground">{row.prompt}</dt>
              <dd className="mt-1 whitespace-pre-line text-sm text-foreground">{row.answer}</dd>
            </div>
          ))}
        </dl>
      ) : null}
    </div>
  );
}

/** Step 3 review: what was confirmed, without reopening Stripe. */
export function PostEventPaymentReview({ registration }: { registration: ProgramRegistrationState }) {
  const confirmed = shortDate(registration.payoutDetailsConfirmedAt ?? registration.honorariumRequestedAt);
  return (
    <div className="space-y-2">
      <p className="inline-flex items-start gap-2 text-sm font-medium text-foreground">
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden />
        <span>Payment info confirmed{confirmed ? ` on ${confirmed}` : ''}.</span>
      </p>
      {registration.payoutDetailsEntryKind ? (
        <p className="text-sm text-muted-foreground">
          {registration.payoutDetailsEntryKind === 'REUSED'
            ? 'You used the payout details already saved on your account.'
            : 'You added or updated your payout details for this session.'}
        </p>
      ) : null}
      <p className="text-sm text-muted-foreground">
        To change your bank or tax details for future payments, go to{' '}
        <Link to="/app/payments" className="font-semibold text-foreground underline">
          Payments
        </Link>
        .
      </p>
    </div>
  );
}

const STATUS_LINE: Record<string, { label: string; tone: 'ok' | 'wait' | 'problem' }> = {
  PENDING: { label: 'Waiting for release', tone: 'wait' },
  PROCESSING: { label: 'On its way to your bank', tone: 'wait' },
  PAID: { label: 'Paid', tone: 'ok' },
  FAILED: { label: 'Payment problem', tone: 'problem' },
  CANCELLED: { label: 'Cancelled', tone: 'problem' },
};

/** Step 4: confirmation and payment timing, with a status line that follows the payment. */
export function PostEventConfirmation(props: {
  registration: ProgramRegistrationState;
  hasHonorarium: boolean;
}) {
  const { registration, hasHonorarium } = props;

  if (!hasHonorarium) {
    return (
      <p className="inline-flex items-start gap-2 text-sm font-medium text-foreground">
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden />
        <span>Thank you. Your survey response is recorded.</span>
      </p>
    );
  }

  const statusKey = registration.honorariumPayment?.status ?? 'PENDING';
  const status = STATUS_LINE[statusKey] ?? STATUS_LINE.PENDING;
  const requested = shortDate(registration.honorariumRequestedAt ?? registration.payoutDetailsConfirmedAt);
  const StatusIcon = status.tone === 'ok' ? CheckCircle2 : status.tone === 'problem' ? AlertTriangle : Clock3;
  const statusTone =
    status.tone === 'ok' ? 'text-success' : status.tone === 'problem' ? 'text-warning' : 'text-foreground';

  return (
    <div className="space-y-3">
      <p className="inline-flex items-start gap-2 text-sm font-medium text-foreground">
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden />
        <span>
          You are all set. Your payment info is confirmed and your honorarium is requested
          {requested ? ` (${requested})` : ''}.
        </span>
      </p>
      <div className="rounded-[6px] border border-border bg-muted/40 px-4 py-3 space-y-1.5">
        <p className={`inline-flex items-center gap-2 text-sm font-semibold ${statusTone}`} role="status">
          <StatusIcon className="h-4 w-4 shrink-0" aria-hidden />
          Payment status: {status.label}
        </p>
        {statusKey === 'PAID' ? (
          <p className="text-sm text-muted-foreground">Your honorarium has been sent to your bank account.</p>
        ) : statusKey === 'FAILED' ? (
          <p className="text-sm text-muted-foreground">
            We could not send your payment. Check your bank details on the Payments page, or contact support.
          </p>
        ) : statusKey === 'CANCELLED' ? (
          <p className="text-sm text-muted-foreground">
            This payment was cancelled. Contact support if you have questions.
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">
            Honoraria are typically sent within{' '}
            <strong className="font-semibold text-foreground">{PAYOUT_WINDOW_LABEL}</strong> by ACH direct deposit.
            This status updates when your payment is released.
          </p>
        )}
      </div>
      <Link to="/app/payments" className="inline-flex text-sm font-semibold text-foreground underline">
        Open Payments
      </Link>
    </div>
  );
}

/** Shown instead of the map to people whose attendance was not confirmed: no payment steps. */
export function PostEventNotAttendee() {
  return (
    <section className="rounded-card border border-border bg-card p-6 space-y-2">
      <h2 className="text-base font-semibold text-foreground">Post-event steps</h2>
      <p className="inline-flex items-start gap-2 text-sm font-medium text-foreground">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden />
        <span>The survey and payment steps are for people who attended the live session.</span>
      </p>
      <p className="text-sm text-muted-foreground">
        We could not confirm your attendance for this session. If you think this is a mistake,{' '}
        <Link to="/app/settings?tab=help" className="font-semibold text-foreground underline">
          contact support
        </Link>
        .
      </p>
    </section>
  );
}
