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
import { PayoutSetupGuide } from './PayoutSetupGuide';
import type { PayoutAccountStatus } from '../../utils/payout-setup';

type ConnectInstance = ReturnType<typeof loadConnectAndInitialize>;

/**
 * Stripe Connect Embedded account onboarding (Express, ACH bank payouts).
 * Renders inside CHT (Payments, Settings, post-event payout step); no full-page Stripe redirect.
 * A short 1-2-3 guide above the form says, from the live account status, whether setup is
 * finished, so nobody leaves thinking Stripe is connected when it is not (SCRUM-281).
 */
export function StripeConnectOnboarding(props: {
  userId: string;
  onSuccess: () => void;
  locked?: boolean;
}) {
  const { userId, onSuccess, locked = false } = props;
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  /** Set once the learner closes the Stripe form in this visit, so the guide can say what is left. */
  const [leftStripe, setLeftStripe] = useState(false);

  const statusQuery = useQuery({
    queryKey: ['payments-account-status', userId],
    queryFn: (): Promise<PayoutAccountStatus> => paymentsApi.getAccountStatus(userId),
    enabled: !locked && !!userId,
  });

  const sessionQuery = useQuery({
    queryKey: ['stripe-account-session', userId],
    queryFn: () => paymentsApi.createAccountSession(userId),
    enabled: !locked,
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
    enabled: !!sessionQuery.data?.publishableKey && !locked,
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

  const guide = (
    <PayoutSetupGuide
      status={statusQuery.data}
      leftStripe={leftStripe}
      checking={syncMut.isPending}
      onCheckAgain={() => syncMut.mutate()}
    />
  );

  if (sessionQuery.isLoading || connectInstanceQuery.isLoading) {
    return (
      <div className="space-y-3">
        {guide}
        <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-8 text-sm text-slate-600">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading <StripeMark size="xs" className="mx-0.5" /> payout setup…
        </div>
      </div>
    );
  }

  if (sessionQuery.isError || connectInstanceQuery.isError || !connectInstanceQuery.data) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
        {getApiErrorMessage(
          sessionQuery.error || connectInstanceQuery.error,
          'Could not start Stripe Connect onboarding.',
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {guide}
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
              setLeftStripe(true);
              syncMut.mutate();
            }}
            onLoadError={({ error: loadError }) => {
              setError(loadError?.message || 'Failed to load Stripe onboarding.');
            }}
          />
        </ConnectComponentsProvider>
      </div>
    </div>
  );
}
