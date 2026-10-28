import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import {
  programsApi,
  type ProgramRegistrationState,
} from '../../api/programs';
import { surveysApi } from '../../api/surveys';
import { StripeConnectOnboarding } from '../payments/StripeConnectOnboarding';
import { BankCardVisual } from '../payments/PayoutBankCard';
import { derivePayoutSetup } from '../../utils/payout-setup';
import { StripeMark } from '../branding/StripeMark';
import { PAYOUT_WINDOW_LABEL } from '../../utils/payout-timing';

/**
 * Inline post-event payment step (not survey form fields).
 * Ready → summary + Continue / Edit. Incomplete → 1-2-3 setup guide (what Stripe still needs) + embedded Stripe Connect.
 */
export function PostEventPayoutStep(props: {
  programId: string;
  userId: string;
  myRegistration: ProgramRegistrationState;
  feedbackSurveyId?: string;
  nativeSurveyMode?: boolean;
  onSubmitted?: () => void;
}) {
  const {
    programId,
    userId,
    myRegistration,
    feedbackSurveyId,
    nativeSurveyMode = false,
    onSubmitted,
  } = props;
  const queryClient = useQueryClient();
  const surveyAcked = !!myRegistration.postEventSurveyAcknowledgedAt;
  const honorariumDone = !!(
    myRegistration.honorariumRequestedAt || myRegistration.honorariumPayment
  );

  const [editing, setEditing] = useState(false);
  /** Tracks whether Connect was opened in this visit (setup or edit). */
  const [touchedSetup, setTouchedSetup] = useState(false);

  const {
    data: preview,
    isError: previewError,
    isLoading: previewLoading,
    refetch: refetchPreview,
  } = useQuery({
    queryKey: ['programs', programId, 'honorarium-preview'],
    queryFn: () => programsApi.getHonorariumPreview(programId),
    enabled: !honorariumDone,
    retry: false,
  });

  const payoutReady = preview?.payoutReady ?? false;
  /** Editing only applies to a ready account; an account that is not ready shows setup instead. */
  const editingDetails = editing && payoutReady;

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['program', programId, 'registration'] });
    queryClient.invalidateQueries({ queryKey: ['programs', 'live-action-items'] });
    queryClient.invalidateQueries({ queryKey: ['payments', userId, 'summary'] });
    queryClient.invalidateQueries({ queryKey: ['surveys'] });
    queryClient.invalidateQueries({ queryKey: ['programs', programId, 'honorarium-preview'] });
    if (feedbackSurveyId) {
      queryClient.invalidateQueries({ queryKey: ['survey', feedbackSurveyId, 'my-response'] });
    }
  };

  const finalizeMut = useMutation({
    mutationFn: async () => {
      if (feedbackSurveyId && !surveyAcked) {
        const mine = await surveysApi.getMyResponse(feedbackSurveyId);
        const answers = mine.answers ?? {};
        if (!mine.submitted) {
          await surveysApi.submitResponse(feedbackSurveyId, {
            answers,
            draft: false,
          });
        }
      } else if (!surveyAcked && !nativeSurveyMode) {
        await programsApi.acknowledgePostEventSurvey(programId);
      }
      const entryKind = touchedSetup || editingDetails ? 'NEWLY_ENTERED' : 'REUSED';
      return programsApi.requestPostEventHonorarium(programId, { entryKind });
    },
    onSuccess: () => {
      invalidate();
      onSubmitted?.();
    },
  });

  const onConnectSuccess = () => {
    setTouchedSetup(true);
    setEditing(false);
    void refetchPreview();
    void queryClient.invalidateQueries({ queryKey: ['payments-account-status', userId] });
  };

  if (honorariumDone) {
    return (
      <div className="space-y-3">
        <p className="text-sm font-medium text-success inline-flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden />
          Payment request submitted
        </p>
        <p className="text-sm text-muted-foreground">
          Your honorarium is pending admin review. Payouts are typically sent within{' '}
          <strong className="font-semibold text-foreground">{PAYOUT_WINDOW_LABEL}</strong> after submission via
          ACH once your bank and tax details are connected.
        </p>
        {myRegistration.payoutDetailsEntryKind ? (
          <p className="text-xs text-muted-foreground">
            Details for this session:{' '}
            {myRegistration.payoutDetailsEntryKind === 'REUSED'
              ? 'reused existing payout info'
              : 'newly entered or updated'}
            {myRegistration.payoutDetailsConfirmedAt
              ? ` · confirmed ${format(new Date(myRegistration.payoutDetailsConfirmedAt), 'MMM d, yyyy')}`
              : ''}
          </p>
        ) : null}
        <Link to="/app/payments" className="inline-flex text-sm font-semibold text-foreground underline">
          Open Payments dashboard
        </Link>
      </div>
    );
  }

  if (previewLoading) {
    return (
      <p className="text-sm text-muted-foreground inline-flex items-center gap-2">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading payout details…
      </p>
    );
  }

  if (previewError || !preview) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-destructive">
          Could not load payout details. Check your connection and try again.
        </p>
        <button
          type="button"
          onClick={() => void refetchPreview()}
          className="inline-flex rounded-[6px] border border-border bg-card px-4 py-2.5 text-sm font-semibold text-foreground hover:bg-muted"
        >
          Retry
        </button>
      </div>
    );
  }

  const showInlineSetup = !payoutReady || editingDetails;
  const bankLabel = preview.maskedBankLast4
    ? `Bank account ending ${preview.maskedBankLast4}`
    : 'Bank account on file (last digits unavailable)';

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Your survey answers are saved. Now confirm where to send your honorarium. Your answers and the honorarium
        request are sent together when you continue.
      </p>

      {payoutReady && !editingDetails ? (
        <div className="grid gap-5 rounded-card border border-border bg-card p-5 sm:grid-cols-[minmax(0,260px)_1fr] sm:items-center">
          <div className="max-w-[300px]">
            <BankCardVisual setup={derivePayoutSetup({ hasAccount: true, detailsSubmitted: true, payoutsEnabled: true, w9Submitted: true })} last4={preview.maskedBankLast4} holderName={preview.payeeDisplayName} />
          </div>
          <div className="space-y-3">
            <p className="text-sm font-medium text-success inline-flex flex-wrap items-center gap-2">
              <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden />
              <span className="inline-flex flex-wrap items-center gap-1.5">
                Account connected via <StripeMark size="xs" className="translate-y-px" />
              </span>
            </p>
            <ul className="text-sm text-foreground space-y-1.5">
              <li>
                <span className="font-medium">Payee: </span>
                {preview.payeeDisplayName}
              </li>
              <li>
                <span className="font-medium">Method: </span>
                {preview.methodLabel ?? 'ACH direct deposit'}
              </li>
              <li>
                <span className="font-medium">Account: </span>
                {bankLabel}
              </li>
              {preview.detailsAddedAt ? (
                <li>
                  <span className="font-medium">Added: </span>
                  {format(new Date(preview.detailsAddedAt), 'MMM d, yyyy')}
                </li>
              ) : null}
              {preview.addressSummary ? (
                <li>
                  <span className="font-medium">Address on profile: </span>
                  {preview.addressSummary}
                </li>
              ) : null}
              {(preview.missingRequirements ?? []).includes('BANK_ACCOUNT') ? (
                <li className="text-amber">
                  Bank last digits are not available yet. You can continue, or tap Edit to refresh details.
                </li>
              ) : null}
            </ul>
            <div className="flex flex-wrap gap-2 pt-1">
              <button
                type="button"
                disabled={finalizeMut.isPending || finalizeMut.isSuccess}
                onClick={() => finalizeMut.mutateAsync().catch(() => {})}
                className="inline-flex min-h-[44px] items-center gap-2 rounded-[10px] bg-anchor px-5 text-sm font-semibold text-white shadow-card hover:bg-cta-deep disabled:opacity-50"
              >
                {finalizeMut.isPending ? 'Submitting…' : 'Continue with this payment info'}
              </button>
              <button
                type="button"
                disabled={finalizeMut.isPending}
                onClick={() => {
                  setEditing(true);
                  setTouchedSetup(true);
                }}
                className="inline-flex min-h-[44px] items-center rounded-[10px] border border-border bg-card px-4 text-sm font-semibold text-foreground hover:bg-muted disabled:opacity-50"
              >
                Edit
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showInlineSetup ? (
        <div className="space-y-3">
          {editingDetails ? (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-muted-foreground">
                Update your <StripeMark size="xs" className="translate-y-px" /> bank or tax details, then
                return here.
              </p>
              <button
                type="button"
                onClick={() => {
                  setEditing(false);
                  void refetchPreview();
                }}
                className="text-sm font-semibold text-foreground underline"
              >
                Done editing
              </button>
            </div>
          ) : null}
          <StripeConnectOnboarding
            userId={userId}
            onSuccess={onConnectSuccess}
            startOpen={editingDetails}
            holderName={preview.payeeDisplayName}
          />
          {payoutReady && editingDetails ? (
            <button
              type="button"
              disabled={finalizeMut.isPending}
              onClick={() => {
                setEditing(false);
                void finalizeMut.mutateAsync().catch(() => {});
              }}
              className="inline-flex rounded-[6px] bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-black disabled:opacity-50"
            >
              {finalizeMut.isPending ? 'Submitting…' : 'Continue with this payment info'}
            </button>
          ) : null}
        </div>
      ) : null}

      {finalizeMut.isError ? (
        <p className="text-sm text-destructive">
          Could not submit. Fix any payment issues above and try again.
        </p>
      ) : null}
    </div>
  );
}
