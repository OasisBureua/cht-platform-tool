import { useCallback, useState } from 'react';
import {
  ConnectComponentsProvider,
  ConnectAccountOnboarding,
} from '@stripe/react-connect-js';
import { loadConnectAndInitialize } from '@stripe/connect-js';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { paymentsApi } from '../../api/payments';
import { getApiErrorMessage } from '../../api/client';
import { StripeMark } from '../branding/StripeMark';
import { PayoutBankCard } from './PayoutBankCard';
import { derivePayoutSetup, type PayoutAccountStatus } from '../../utils/payout-setup';

type ConnectInstance = ReturnType<typeof loadConnectAndInitialize>;

/**
 * Stripe payout setup (Payments, Settings, post-event payment step), SCRUM-281.
 * A bank card shows, from the live account status, whether setup is finished and what Stripe
 * still needs, with one button that opens the embedded Stripe Connect form (Express, ACH payouts).
 * The Stripe account session is only created once the form is opened.
 */
export function StripeConnectOnboarding(props: {
  userId: string;
  onSuccess: () => void;
  locked?: boolean;
  /** Open the Stripe form straight away (edit flows that already asked to update details). */
  startOpen?: boolean;
}) {
  const { userId, onSuccess, locked = false, startOpen = false } = props;
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(startOpen);
  /** Set once the learner closes the Stripe form in this visit, so the card can say what is left. */
  const [leftStripe, setLeftStripe] = useState(false);
  const [startTipVisible, setStartTipVisible] = useState(!startOpen);

  const statusQuery = useQuery({
    queryKey: ['payments-account-status', userId],
    queryFn: (): Promise<PayoutAccountStatus> => paymentsApi.getAccountStatus(userId),
    enabled: !locked && !!userId,
  });

  const sessionQuery = useQuery({
    queryKey: ['stripe-account-session', userId],
    queryFn: () => paymentsApi.createAccountSession(userId),
    enabled: !locked && formOpen,
    staleTime: 0,
    retry: 1,
  });

  const fetchClientSecret = useCallback(async () => {
    const session = await paymentsApi.createAccountSession(userId);
    return session.clientSecret;
  }, [userId]);

  const connectInstanceQuery = useQuery({
    queryKey: [
      'stripe-connect-instance',
      userId,
      sessionQuery.data?.publishableKey,
    ],
    enabled: !!sessionQuery.data?.publishableKey && !locked && formOpen,
    staleTime: Infinity,
    queryFn: async (): Promise<ConnectInstance> => {
      const publishableKey = sessionQuery.data!.publishableKey;
      return loadConnectAndInitialize({
        publishableKey,
        fetchClientSecret,
        appearance: {
          overlays: 'dialog',
          variables: {
            colorPrimary: '#635BFF',
          },
        },
      });
    },
  });

  /** Ask Stripe for the latest account state, then refresh every view of it. */
  const syncMut = useMutation({
    mutationFn: () => paymentsApi.syncAccountStatus(userId),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['payments-account-status', userId] });
      onSuccess();
    },
  });

  if (locked) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        Complete your profession and NPI under Settings before connecting payouts.
      </div>
    );
  }

  const setup = derivePayoutSetup(statusQuery.data);

  let form = null;
  if (formOpen) {
    if (sessionQuery.isLoading || connectInstanceQuery.isLoading) {
      form = (
        <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-8 text-sm text-slate-600">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading <StripeMark size="xs" className="mx-0.5" /> payout setup…
        </div>
      );
    } else if (sessionQuery.isError || connectInstanceQuery.isError || !connectInstanceQuery.data) {
      form = (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {getApiErrorMessage(
            sessionQuery.error || connectInstanceQuery.error,
            'Could not start Stripe Connect onboarding.',
          )}
        </div>
      );
    } else {
      form = (
        <>
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
              {error}
            </div>
          )}
          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white p-2 sm:p-4">
            <p className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Stripe form</p>
            <ConnectComponentsProvider connectInstance={connectInstanceQuery.data}>
              <ConnectAccountOnboarding
                onExit={() => {
                  setError(null);
                  setFormOpen(false);
                  setLeftStripe(true);
                  syncMut.mutate();
                }}
                onLoadError={({ error: loadError }) => {
                  setError(loadError?.message || 'Failed to load Stripe onboarding.');
                }}
              />
            </ConnectComponentsProvider>
          </div>
        </>
      );
    }
  }

  return (
    <PayoutBankCard
      status={statusQuery.data}
      formOpen={formOpen}
      leftStripe={leftStripe}
      checking={syncMut.isPending}
      startTipVisible={startTipVisible}
      onDismissStartTip={() => setStartTipVisible(false)}
      onPrimary={() => {
        if (setup.phase === 'verifying') {
          syncMut.mutate();
          return;
        }
        setFormOpen(true);
      }}
    >
      {form}
    </PayoutBankCard>
  );
}
