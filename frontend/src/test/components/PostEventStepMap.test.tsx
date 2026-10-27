import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { PostEventStepMap } from '../../components/programs/PostEventStepMap';
import { derivePostEventProgress, type PostEventProgressFacts } from '../../utils/post-event-steps';

const facts: PostEventProgressFacts = {
  hasSurvey: true,
  hasHonorarium: true,
  nativeSurvey: true,
  attendance: 'VERIFIED',
  surveyAcknowledged: false,
  surveySubmitted: false,
  surveyDraftSaved: true,
  paymentInfoConfirmed: false,
  paymentStatus: null,
};

function renderMap(f: Partial<PostEventProgressFacts> = {}, onSelect = vi.fn()) {
  const p = derivePostEventProgress({ ...facts, ...f });
  render(
    <MemoryRouter>
      <PostEventStepMap steps={p.steps} active={p.active} onSelect={onSelect} />
    </MemoryRouter>,
  );
  // The desktop stepper is the first list; the phone list is the second.
  const [desktop] = screen.getAllByRole('list', { hidden: true });
  return { desktop, onSelect };
}

describe('PostEventStepMap', () => {
  it('puts aria-current on the step in progress', () => {
    const { desktop } = renderMap();
    const current = within(desktop).getByRole('button', { name: /Step 3 of 4: Payment info, current step/ });
    expect(current).toHaveAttribute('aria-current', 'step');
  });

  it('lets done steps be opened and keeps future steps out of the tab order', () => {
    const { desktop, onSelect } = renderMap();
    fireEvent.click(within(desktop).getByRole('button', { name: /Step 2 of 4: Survey, complete/ }));
    expect(onSelect).toHaveBeenCalledWith('survey');
    expect(within(desktop).queryByRole('button', { name: /Done/ })).toBeNull();
    const future = within(desktop).getByText('Step 4 of 4:');
    expect(future.closest('button, a')).toBeNull();
  });

  it('shows one helper line under the step in progress', () => {
    const { desktop } = renderMap();
    expect(within(desktop).getByText('Check where we should send your honorarium, then confirm.')).toBeInTheDocument();
  });

  it('announces a step that needs attention in words, not only color', () => {
    const { desktop } = renderMap({ payoutReady: false });
    expect(
      within(desktop).getByRole('button', { name: /Step 3 of 4: Payment info, needs attention/ }),
    ).toBeInTheDocument();
  });

  it('has a compact Step N of M bar for phones with an expandable list', () => {
    renderMap();
    expect(screen.getByText('Step 3 of 4')).toBeInTheDocument();
    const toggle = screen.getByRole('button', { name: 'All steps' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('button', { name: /Step 1 of 4: Attend the session, complete/ })).toBeInTheDocument();
  });

  it('renders links when steps open another page', () => {
    const p = derivePostEventProgress(facts);
    render(
      <MemoryRouter>
        <PostEventStepMap steps={p.steps} active={p.active} stepHref={(k) => `/app/live/p1?step=${k}`} />
      </MemoryRouter>,
    );
    const [desktop] = screen.getAllByRole('list', { hidden: true });
    expect(within(desktop).getByRole('link', { name: /Survey, complete/ })).toHaveAttribute(
      'href',
      '/app/live/p1?step=survey',
    );
  });
});
