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

const heroPills = () => screen.getByRole('list', { name: 'Post-event progress' });
const wizard = () => screen.getByRole('dialog');

describe('PostEventParticipantFlow hero and wizard', () => {
  beforeEach(() => {
    mocks.myResponse = null;
    mocks.payoutReady = true;
    localStorage.clear();
  });

  it('starts an attendee at the survey with step 1 complete', async () => {
    renderFlow(reg());
    expect(await screen.findByText('Complete the survey')).toBeInTheDocument();
    expect(within(heroPills()).getByRole('button', { name: /Step 1 of 4: Attend, complete/ })).toBeInTheDocument();
    expect(within(heroPills()).getByRole('button', { name: /Step 2 of 4: Survey, current step/ })).toHaveAttribute(
      'aria-current',
      'step',
    );
  });

  it('opens the survey in the wizard with one tap on the hero button', async () => {
    renderFlow(reg());
    fireEvent.click(await screen.findByRole('button', { name: /Start the survey/ }));
    const dialog = wizard();
    expect(within(dialog).getByRole('heading', { name: 'Complete the survey' })).toHaveFocus();
    expect(within(dialog).getByText('Step 2 of 4')).toBeInTheDocument();
    expect(localStorage.getItem('post-event-flow-started:p1')).toBe('1');
  });

  it('resumes at payment info after the survey, with steps 1 and 2 complete', async () => {
    mocks.myResponse = { submitted: false, draft: true, answers: { q1: 'Order the panel earlier' } };
    renderFlow(reg());
    expect(await screen.findByText('Confirm payment information')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Confirm payment info/ }));
    const steps = within(wizard()).getByRole('list', { name: 'Post-event progress' });
    expect(within(steps).getByRole('button', { name: /Step 1 of 4: Attend, complete/ })).toBeInTheDocument();
    expect(within(steps).getByRole('button', { name: /Step 2 of 4: Survey, complete/ })).toBeInTheDocument();
    expect(within(steps).getByRole('button', { name: /Step 3 of 4: Payment info, current step/ })).toHaveAttribute(
      'aria-current',
      'step',
    );
    expect(await within(wizard()).findByRole('button', { name: 'Continue with this payment info' })).toBeInTheDocument();
  });

  it('reviews a done step inside the wizard and returns to the step in progress', async () => {
    mocks.myResponse = { submitted: false, draft: true, answers: { q1: 'Order the panel earlier' } };
    renderFlow(reg());
    fireEvent.click(await screen.findByRole('button', { name: /Confirm payment info/ }));
    const steps = within(wizard()).getByRole('list', { name: 'Post-event progress' });
    fireEvent.click(within(steps).getByRole('button', { name: /Step 2 of 4: Survey, complete/ }));
    expect(within(wizard()).getByText('Reviewing step 2 of 4')).toBeInTheDocument();
    expect(within(wizard()).getByRole('heading', { name: 'Complete the survey' })).toHaveFocus();
    expect(await within(wizard()).findByText('Order the panel earlier')).toBeInTheDocument();
    fireEvent.click(within(wizard()).getByRole('button', { name: 'Back to step 3: Payment info' }));
    expect(within(wizard()).getByRole('heading', { name: 'Confirm payment information' })).toHaveFocus();
  });

  it('flags payment info and asks to set up payouts when details are missing', async () => {
    mocks.myResponse = { submitted: false, draft: true, answers: {} };
    mocks.payoutReady = false;
    renderFlow(reg());
    expect(await screen.findByRole('button', { name: /Set up payouts/ })).toBeInTheDocument();
    expect(
      within(heroPills()).getByRole('button', { name: /Step 3 of 4: Payment info, needs attention/ }),
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
    expect(await screen.findByText('Your honorarium is requested')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /View payment status/ }));
    expect(within(wizard()).getByRole('heading', { name: 'Confirmation and payment timing' })).toBeInTheDocument();
    expect(within(wizard()).getByRole('status')).toHaveTextContent('Payment status: Waiting for release');
  });

  it('opens the wizard on the step named in ?step= from the dashboard card', async () => {
    mocks.myResponse = { submitted: false, draft: true, answers: { q1: 'Order the panel earlier' } };
    renderFlow(reg(), '/app/live/p1?step=survey');
    expect(await within(wizard()).findByText('Reviewing step 2 of 4')).toBeInTheDocument();
  });

  it('closes the wizard with Escape', async () => {
    renderFlow(reg());
    fireEvent.click(await screen.findByRole('button', { name: /Start the survey/ }));
    expect(wizard()).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('keeps step 1 in progress while attendance is being verified, with nothing to tap yet', async () => {
    renderFlow(reg({ postEventAttendanceStatus: 'PENDING_VERIFICATION' }));
    expect(await screen.findByText('We are confirming your attendance')).toBeInTheDocument();
    expect(within(heroPills()).queryByRole('button', { name: /Payment info/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Start the survey/ })).toBeNull();
  });

  it('shows non-attendees a clear message and no payment steps', () => {
    renderFlow(reg({ postEventAttendanceStatus: 'DENIED' }));
    expect(
      screen.getByText('The survey and payment steps are for people who attended the live session.'),
    ).toBeInTheDocument();
    expect(screen.queryByText('Payment info')).toBeNull();
  });
});
