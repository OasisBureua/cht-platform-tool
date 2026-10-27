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

describe('StripeConnectOnboarding setup guide', () => {
  beforeEach(() => {
    state.status = { hasAccount: true, detailsSubmitted: false, payoutsEnabled: false, w9Submitted: false };
  });

  it('shows the 1-2-3 steps with the next one marked', async () => {
    renderOnboarding();
    expect(await screen.findByRole('heading', { name: 'Get paid in 3 steps' })).toBeInTheDocument();
    expect(await screen.findByText('Not finished')).toBeInTheDocument();
    const next = screen.getByText('Add your details').closest('li')!;
    expect(next).toHaveAttribute('aria-current', 'step');
    expect(next).toHaveTextContent('Next');
  });

  it('says plainly that setup is not finished after leaving Stripe early', async () => {
    const { onSuccess } = renderOnboarding();
    fireEvent.click(await screen.findByRole('button', { name: 'Close Stripe' }));
    const notice = await screen.findByRole('status');
    expect(notice).toHaveTextContent('Setup is not finished yet.');
    expect(notice).toHaveTextContent(
      'Stripe still needs your personal details, bank account and tax info (W-9).',
    );
    expect(onSuccess).toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Check again' })).toBeInTheDocument();
  });

  it('tells people Stripe is still checking once their details are in', async () => {
    state.status = { hasAccount: true, detailsSubmitted: true, payoutsEnabled: false, w9Submitted: true };
    renderOnboarding();
    fireEvent.click(await screen.findByRole('button', { name: 'Close Stripe' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Stripe is checking your details');
  });

  it('collapses to a single ready line once payouts are set up', async () => {
    state.status = { hasAccount: true, detailsSubmitted: true, payoutsEnabled: true, w9Submitted: true };
    renderOnboarding();
    expect(await screen.findByText('Ready for payouts')).toBeInTheDocument();
    expect(screen.queryByText('Get paid in 3 steps')).toBeNull();
    fireEvent.click(await screen.findByRole('button', { name: 'Close Stripe' }));
    expect(screen.queryByRole('status')).toBeNull();
  });
});
