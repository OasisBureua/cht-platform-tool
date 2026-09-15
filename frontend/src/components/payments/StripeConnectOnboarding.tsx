import { useCallback, useState } from 'react';
import {
  ConnectComponentsProvider,
  ConnectAccountOnboarding,
} from '@stripe/react-connect-js';
import { loadConnectAndInitialize } from '@stripe/connect-js';
import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { paymentsApi } from '../../api/payments';
import { getApiErrorMessage } from '../../api/client';
import { StripeMark } from '../branding/StripeMark';

type ConnectInstance = ReturnType<typeof loadConnectAndInitialize>;

/**
 * Stripe Connect Embedded account onboarding (Express, ACH bank payouts).
 * Renders inside CHT Settings — no full-page Stripe redirect required.
 */
export function StripeConnectOnboarding(props: {
  userId: string;
  onSuccess: () => void;
  locked?: boolean;
}) {
  const { userId, onSuccess, locked = false } = props;
  const [error, setError] = useState<string | null>(null);

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

  if (locked) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        Complete your profession and NPI under Settings before connecting payouts.
      </div>
    );
  }

  if (sessionQuery.isLoading || connectInstanceQuery.isLoading) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-8 text-sm text-slate-600">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading <StripeMark size="xs" className="mx-0.5" /> payout setup…
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
      <p className="text-sm text-slate-600">
        Connect your bank account for <strong>ACH direct deposit</strong> through{' '}
        <StripeMark size="xs" className="translate-y-px" />. Paper checks are not
        supported. Use your legal name or business entity as it should appear on
        payouts and tax forms.
      </p>
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </div>
      )}
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white p-2 sm:p-4">
        <ConnectComponentsProvider connectInstance={connectInstanceQuery.data}>
          <ConnectAccountOnboarding
            onExit={() => {
              setError(null);
              void paymentsApi.syncAccountStatus(userId).finally(() => onSuccess());
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
