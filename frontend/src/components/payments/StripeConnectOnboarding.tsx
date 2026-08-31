import { useCallback, useEffect, useState } from 'react';
import {
  ConnectComponentsProvider,
  ConnectAccountOnboarding,
} from '@stripe/react-connect-js';
import { loadConnectAndInitialize } from '@stripe/connect-js/pure';
import type { StripeConnectInstance } from '@stripe/connect-js';
import { Loader2 } from 'lucide-react';
import { paymentsApi } from '../../api/payments';
import { getApiErrorMessage } from '../../api/client';
import { StripeMark } from '../branding/StripeMark';

/**
 * Survive React StrictMode double-mount: Connect.js creates a body iframe
 * ("data layer") per loadConnectAndInitialize call. Calling it twice races and
 * surfaces "Data layer message channel was not initialized within 10000ms".
 */
const connectInstances = new Map<string, StripeConnectInstance>();

function getConnectInstance(
  userId: string,
  publishableKey: string,
  fetchClientSecret: () => Promise<string>,
): StripeConnectInstance {
  const cacheKey = `${userId}:${publishableKey}`;
  const existing = connectInstances.get(cacheKey);
  if (existing) return existing;
  const instance = loadConnectAndInitialize({
    publishableKey,
    fetchClientSecret,
    appearance: {
      overlays: 'dialog',
      variables: {
        colorPrimary: '#635BFF',
      },
    },
  });
  connectInstances.set(cacheKey, instance);
  return instance;
}

/**
 * Stripe Connect Embedded account onboarding (Express, ACH bank payouts).
 * Falls back to hosted Account Link if the embed data layer fails to init.
 */
export function StripeConnectOnboarding(props: {
  userId: string;
  onSuccess: () => void;
  locked?: boolean;
}) {
  const { userId, onSuccess, locked = false } = props;
  const [error, setError] = useState<string | null>(null);
  const [connectInstance, setConnectInstance] =
    useState<StripeConnectInstance | null>(null);
  const [initError, setInitError] = useState<string | null>(null);
  const [booting, setBooting] = useState(!locked);
  const [hostedLoading, setHostedLoading] = useState(false);

  const fetchClientSecret = useCallback(async () => {
    const session = await paymentsApi.createAccountSession(userId);
    return session.clientSecret;
  }, [userId]);

  useEffect(() => {
    if (locked) {
      setBooting(false);
      return;
    }

    let cancelled = false;
    setBooting(true);
    setInitError(null);

    (async () => {
      try {
        // One Account Session call yields publishableKey + proves API is healthy.
        const session = await paymentsApi.createAccountSession(userId);
        if (cancelled) return;
        const instance = getConnectInstance(
          userId,
          session.publishableKey,
          fetchClientSecret,
        );
        setConnectInstance(instance);
      } catch (err) {
        if (cancelled) return;
        setInitError(
          getApiErrorMessage(err, 'Could not start Stripe Connect onboarding.'),
        );
      } finally {
        if (!cancelled) setBooting(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [userId, locked, fetchClientSecret]);

  const openHostedOnboarding = async () => {
    setHostedLoading(true);
    setError(null);
    try {
      const { url } = await paymentsApi.createConnectLink(userId);
      window.location.assign(url);
    } catch (err) {
      setError(
        getApiErrorMessage(err, 'Could not open Stripe hosted onboarding.'),
      );
      setHostedLoading(false);
    }
  };

  if (locked) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        Complete your profession and NPI under Settings before connecting payouts.
      </div>
    );
  }

  if (booting) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-8 text-sm text-slate-600">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading <StripeMark size="xs" className="mx-0.5" /> payout setup…
      </div>
    );
  }

  if (initError || !connectInstance) {
    return (
      <div className="space-y-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
        <p>{initError || 'Could not start Stripe Connect onboarding.'}</p>
        <button
          type="button"
          disabled={hostedLoading}
          onClick={() => void openHostedOnboarding()}
          className="rounded-[6px] border border-red-300 bg-white px-3 py-2 text-sm font-semibold text-red-900 hover:bg-red-100 disabled:opacity-50"
        >
          {hostedLoading ? 'Opening…' : 'Continue on Stripe instead'}
        </button>
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
        <div className="space-y-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          <p>{error}</p>
          <button
            type="button"
            disabled={hostedLoading}
            onClick={() => void openHostedOnboarding()}
            className="rounded-[6px] border border-red-300 bg-white px-3 py-1.5 text-sm font-semibold text-red-900 hover:bg-red-100 disabled:opacity-50"
          >
            {hostedLoading ? 'Opening…' : 'Continue on Stripe instead'}
          </button>
        </div>
      )}
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white p-2 sm:p-4 min-h-[320px]">
        <ConnectComponentsProvider connectInstance={connectInstance}>
          <ConnectAccountOnboarding
            onExit={() => {
              setError(null);
              void paymentsApi.syncAccountStatus(userId).finally(() => onSuccess());
            }}
            onLoadError={({ error: loadError }) => {
              setError(
                loadError?.message ||
                  'Failed to load Stripe onboarding in-page. You can continue on Stripe’s site.',
              );
            }}
          />
        </ConnectComponentsProvider>
      </div>
    </div>
  );
}
