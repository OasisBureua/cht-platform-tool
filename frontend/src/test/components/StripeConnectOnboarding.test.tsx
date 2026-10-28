import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StripeConnectOnboarding } from '../../components/payments/StripeConnectOnboarding';

const state = vi.hoisted(() => ({
  status: { hasAccount: true, detailsSubmitted: false, payoutsEnabled: false, w9Submitted: false } as Record<
    string,
    unknown
  >,
}));

vi.mock('../../api/payments', () => ({
  paymentsApi: {
    getAccountStatus: vi.fn(async () => state.status),
    createAccountSession: vi.fn(async () => ({
      clientSecret: 'cs_test',
      publishableKey: 'pk_test',
      accountId: 'acct_test',
      expiresAt: 0,
    })),
    syncAccountStatus: vi.fn(async () => state.status),
  },
}));

vi.mock('@stripe/connect-js', () => ({ loadConnectAndInitialize: () => ({ test: true }) }));

// Stand-in for Stripe's embedded form: a button that leaves the form the way people do.
vi.mock('@stripe/react-connect-js', () => ({
  ConnectComponentsProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  ConnectAccountOnboarding: ({ onExit }: { onExit: () => void }) => (
    <button type="button" onClick={onExit}>
      Close Stripe
    </button>
  ),
}));

function renderOnboarding(onSuccess = vi.fn()) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <StripeConnectOnboarding userId="u1" onSuccess={onSuccess} />
    </QueryClientProvider>,
  );
  return { onSuccess };
}

describe('StripeConnectOnboarding bank card flow', () => {
  beforeEach(() => {
    state.status = { hasAccount: false, detailsSubmitted: false, payoutsEnabled: false, w9Submitted: false };
  });

  it('starts with an empty bank card, the 3 steps and one button, without opening Stripe yet', async () => {
    const { paymentsApi } = await import('../../api/payments');
    renderOnboarding();
    expect(await screen.findByRole('heading', { name: 'Get paid by direct deposit' })).toBeInTheDocument();
    expect(screen.getByText('Add your bank account')).toBeInTheDocument();
    expect(screen.getByText('Open the Stripe form').closest('li')).toHaveAttribute('aria-current', 'step');
    expect(screen.queryByRole('button', { name: 'Close Stripe' })).toBeNull();
    expect(paymentsApi.createAccountSession).not.toHaveBeenCalled();
  });

  it('opens the Stripe form with a "Start here" tip from the one button', async () => {
    renderOnboarding();
    fireEvent.click(await screen.findByRole('button', { name: /Set up payouts/ }));
    expect(await screen.findByRole('button', { name: 'Close Stripe' })).toBeInTheDocument();
    expect(screen.getByText(/Tap the button in the Stripe form/)).toBeInTheDocument();
  });

  it('says plainly that setup is not finished after leaving Stripe early', async () => {
    state.status = { hasAccount: true, detailsSubmitted: false, payoutsEnabled: false, w9Submitted: false };
    const { onSuccess } = renderOnboarding();
    fireEvent.click(await screen.findByRole('button', { name: /Finish setup in Stripe/ }));
    fireEvent.click(await screen.findByRole('button', { name: 'Close Stripe' }));
    expect(await screen.findByText('Almost there: setup is not finished')).toBeInTheDocument();
    expect(
      screen.getByText('Stripe still needs your personal details, bank account and tax info (W-9).'),
    ).toBeInTheDocument();
    expect(screen.getByText('Pick up where you stopped. Stripe keeps what you already entered.')).toBeInTheDocument();
    expect(screen.getByText('Bank account').closest('li')).toHaveTextContent('still needed');
    expect(onSuccess).toHaveBeenCalled();
  });

  it('offers a status check while Stripe verifies the details', async () => {
    state.status = { hasAccount: true, detailsSubmitted: true, payoutsEnabled: false, w9Submitted: true };
    renderOnboarding();
    expect(await screen.findByRole('heading', { name: 'Stripe is checking your details' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Check status' }));
    const { paymentsApi } = await import('../../api/payments');
    expect(paymentsApi.syncAccountStatus).toHaveBeenCalled();
  });

  it('shows the teal card with the last 4 digits once payouts are ready', async () => {
    state.status = { hasAccount: true, detailsSubmitted: true, payoutsEnabled: true, w9Submitted: true, bankAccountLast4: '6789' };
    renderOnboarding();
    expect(await screen.findByRole('heading', { name: 'Ready for payouts' })).toBeInTheDocument();
    expect(screen.getByText(/•••• 6789/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Update bank or tax details' })).toBeInTheDocument();
  });
});
