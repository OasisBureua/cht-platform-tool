import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import PostEventParticipantFlow from '../../components/programs/PostEventParticipantFlow';
import type { ProgramRegistrationState } from '../../api/programs';

const mocks = vi.hoisted(() => ({
  myResponse: null as null | { submitted: boolean; draft?: boolean; answers?: Record<string, unknown> },
  payoutReady: true,
}));

vi.mock('../../api/programs', () => ({
  programsApi: {
    getHonorariumPreview: vi.fn(async () => ({
      programTitle: 'Beta',
      payeeDisplayName: 'Jordan Lee',
      maskedBankLast4: '6789',
      addressSummary: null,
      hasPayoutAccount: true,
      w9Submitted: true,
      stripePayoutsEnabled: mocks.payoutReady,
      missingRequirements: mocks.payoutReady ? [] : ['PAYOUTS_ENABLED'],
      payoutReady: mocks.payoutReady,
    })),
    acknowledgePostEventSurvey: vi.fn(),
    requestPostEventHonorarium: vi.fn(),
  },
}));

vi.mock('../../api/surveys', () => ({
  surveysApi: {
    getMyResponse: vi.fn(async () => mocks.myResponse),
    getById: vi.fn(async () => ({
      id: 'svy-1',
      programId: 'p1',
      title: 'Post-event survey',
      type: 'FEEDBACK',
      questions: {
        sections: [{ id: 's', questions: [{ id: 'q1', type: 'long_text', prompt: 'What will you change?' }] }],
      },
    })),
    getProfilePrefill: vi.fn(async () => ({})),
    submitResponse: vi.fn(),
  },
}));

// Stripe Connect is only rendered when payouts are not ready; keep it inert here.
vi.mock('../../components/payments/StripeConnectOnboarding', () => ({
  StripeConnectOnboarding: () => <p>Stripe setup form</p>,
}));

const program = {
  id: 'p1',
  hasPostEventSurvey: true,
  feedbackSurveyId: 'svy-1',
  hasHonorarium: true,
  zoomSessionType: 'WEBINAR' as const,
  startDate: '2026-10-01T00:00:00.000Z',
  duration: 15,
  zoomSessionEndedAt: '2026-10-01T00:21:00.000Z',
};

const reg = (over: Partial<ProgramRegistrationState> = {}): ProgramRegistrationState => ({
  id: 'r1',
  status: 'APPROVED',
  createdAt: '2026-09-20T00:00:00.000Z',
  postEventAttendanceStatus: 'VERIFIED',
  ...over,
});

function renderFlow(registration: ProgramRegistrationState, path = '/app/live/p1') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <PostEventParticipantFlow program={program} userId="u1" enrolled myRegistration={registration} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const desktopMap = () => screen.getAllByRole('list', { hidden: true })[0];

describe('PostEventParticipantFlow step map', () => {
  beforeEach(() => {
    mocks.myResponse = null;
    mocks.payoutReady = true;
    localStorage.clear();
  });

  it('starts an attendee at the survey with step 1 complete', async () => {
    renderFlow(reg());
    expect(await screen.findByRole('heading', { name: 'Step 2 of 4: Complete the survey' })).toBeInTheDocument();
    expect(within(desktopMap()).getByRole('button', { name: /Step 1 of 4: Attend, complete/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Start survey' })).toBeInTheDocument();
  });

  it('resumes at payment info after the survey, with steps 1 and 2 complete', async () => {
    mocks.myResponse = { submitted: false, draft: true, answers: { q1: 'Order the panel earlier' } };
    renderFlow(reg());
    expect(
      await screen.findByRole('heading', { name: 'Step 3 of 4: Confirm payment information' }),
    ).toBeInTheDocument();
    const map = desktopMap();
    expect(within(map).getByRole('button', { name: /Step 1 of 4: Attend, complete/ })).toBeInTheDocument();
    expect(within(map).getByRole('button', { name: /Step 2 of 4: Survey, complete/ })).toBeInTheDocument();
    expect(within(map).getByRole('button', { name: /Step 3 of 4: Payment info, current step/ })).toHaveAttribute(
      'aria-current',
      'step',
    );
    expect(await screen.findByRole('button', { name: 'Continue with this payment info' })).toBeInTheDocument();
  });

  it('opens a done step for review and returns to the step in progress', async () => {
    mocks.myResponse = { submitted: false, draft: true, answers: { q1: 'Order the panel earlier' } };
    renderFlow(reg());
    await screen.findByRole('heading', { name: 'Step 3 of 4: Confirm payment information' });
    fireEvent.click(within(desktopMap()).getByRole('button', { name: /Step 2 of 4: Survey, complete/ }));
    expect(screen.getByRole('heading', { name: 'Reviewing step 2 of 4: Complete the survey' })).toHaveFocus();
    expect(await screen.findByText('Order the panel earlier')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Back to step 3: Payment info' }));
    expect(screen.getByRole('heading', { name: 'Step 3 of 4: Confirm payment information' })).toHaveFocus();
  });

  it('flags payment info when payout details are missing', async () => {
    mocks.myResponse = { submitted: false, draft: true, answers: {} };
    mocks.payoutReady = false;
    renderFlow(reg());
    expect(
      await within(desktopMap()).findByRole('button', { name: /Step 3 of 4: Payment info, needs attention/ }),
    ).toBeInTheDocument();
  });

  it('shows step 4 with the payment status once payment info is confirmed', async () => {
    renderFlow(
      reg({
        postEventSurveyAcknowledgedAt: '2026-10-01T01:00:00.000Z',
        postEventSurveySubmitted: true,
        honorariumRequestedAt: '2026-10-01T01:00:00.000Z',
        payoutDetailsConfirmedAt: '2026-10-01T01:00:00.000Z',
        honorariumPayment: { id: 'pay', status: 'PENDING' },
      }),
    );
    expect(
      await screen.findByRole('heading', { name: 'Step 4 of 4: Confirmation and payment timing' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Payment status: Waiting for release');
  });

  it('opens the step named in ?step= from the dashboard card', async () => {
    mocks.myResponse = { submitted: false, draft: true, answers: { q1: 'Order the panel earlier' } };
    renderFlow(reg(), '/app/live/p1?step=survey');
    expect(
      await screen.findByRole('heading', { name: 'Reviewing step 2 of 4: Complete the survey' }),
    ).toBeInTheDocument();
  });

  it('keeps step 1 in progress while attendance is being verified', async () => {
    renderFlow(reg({ postEventAttendanceStatus: 'PENDING_VERIFICATION' }));
    expect(await screen.findByRole('heading', { name: 'Step 1 of 4: Attend the session' })).toBeInTheDocument();
    expect(within(desktopMap()).queryByRole('button', { name: /Payment info/ })).toBeNull();
  });

  it('shows non-attendees a clear message and no payment steps', () => {
    renderFlow(reg({ postEventAttendanceStatus: 'DENIED' }));
    expect(
      screen.getByText('The survey and payment steps are for people who attended the live session.'),
    ).toBeInTheDocument();
    expect(screen.queryByText('Payment info')).toBeNull();
  });
});
