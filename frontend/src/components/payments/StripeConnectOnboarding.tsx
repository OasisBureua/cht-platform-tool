import { useState } from 'react';
import {
  ConnectComponentsProvider,
  ConnectAccountOnboarding,
} from '@stripe/react-connect-js';
import { loadConnectAndInitialize } from '@stripe/connect-js/pure';
import type { StripeConnectInstance } from '@stripe/connect-js';
import { ExternalLink, Loader2 } from 'lucide-react';
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

type Mode = 'choose' | 'hosted-loading' | 'embed-loading' | 'embed' | 'error';

/**
 * Stripe Connect onboarding — hosted Account Link is primary (reliable).
 * In-page embed is optional; never touches Bill.com endpoints.
 */
export function StripeConnectOnboarding(props: {
  userId: string;
  onSuccess: () => void;
  locked?: boolean;
}) {
  const { userId, onSuccess, locked = false } = props;
  const [mode, setMode] = useState<Mode>('choose');
  const [error, setError] = useState<string | null>(null);
  const [connectInstance, setConnectInstance] =
    useState<StripeConnectInstance | null>(null);

  const openHostedOnboarding = async () => {
    setMode('hosted-loading');
    setError(null);
    try {
      const { url } = await paymentsApi.createAccountLink(userId);
      window.location.assign(url);
    } catch (err) {
      setError(
        getApiErrorMessage(err, 'Could not open Stripe hosted onboarding.'),
      );
      setMode('error');
    }
  };

  const openEmbeddedOnboarding = async () => {
    setMode('embed-loading');
    setError(null);
    try {
      const session = await paymentsApi.createAccountSession(userId);
      const instance = getConnectInstance(
        userId,
        session.publishableKey,
        async () => {
          const refreshed = await paymentsApi.createAccountSession(userId);
          return refreshed.clientSecret;
        },
      );
      setConnectInstance(instance);
      setMode('embed');
    } catch (err) {
      setError(
        getApiErrorMessage(err, 'Could not start in-page Stripe onboarding.'),
      );
      setMode('error');
    }
  };

  if (locked) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        Complete your profession and NPI under Settings before connecting payouts.
      </div>
    );
  }

  if (mode === 'hosted-loading' || mode === 'embed-loading') {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-8 text-sm text-slate-600">
        <Loader2 className="h-4 w-4 animate-spin" />
        {mode === 'hosted-loading'
          ? 'Opening Stripe…'
          : 'Loading in-page Stripe setup…'}
      </div>
    );
  }

  if (mode === 'embed' && connectInstance) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-slate-600">
          Connect your bank for <strong>ACH direct deposit</strong> through{' '}
          <StripeMark size="xs" className="translate-y-px" />.
        </p>
        {error && (
          <div className="space-y-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            <p>{error}</p>
            <button
              type="button"
              onClick={() => void openHostedOnboarding()}
              className="rounded-[6px] border border-red-300 bg-white px-3 py-1.5 text-sm font-semibold text-red-900 hover:bg-red-100"
            >
              Continue on Stripe’s site
            </button>
          </div>
        )}
        <div className="min-h-[320px] overflow-hidden rounded-lg border border-slate-200 bg-white p-2 sm:p-4">
          <ConnectComponentsProvider connectInstance={connectInstance}>
            <ConnectAccountOnboarding
              onExit={() => {
                setError(null);
                void paymentsApi
                  .syncAccountStatus(userId)
                  .finally(() => onSuccess());
              }}
              onLoadError={({ error: loadError }) => {
                setError(
                  loadError?.message ||
                    'In-page Stripe onboarding failed to load.',
                );
              }}
            />
          </ConnectComponentsProvider>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
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

      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <button
          type="button"
          onClick={() => void openHostedOnboarding()}
          className="inline-flex items-center justify-center gap-2 rounded-[6px] bg-[#635BFF] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#544EE8]"
        >
          <ExternalLink className="h-4 w-4" />
          Connect with Stripe
        </button>
        <button
          type="button"
          onClick={() => void openEmbeddedOnboarding()}
          className="inline-flex items-center justify-center rounded-[6px] border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50"
        >
          Try in-page setup
        </button>
      </div>
    </div>
  );
}
