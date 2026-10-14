import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ContactNoteForm } from '../../components/contact/ContactNoteForm';

const submitContact = vi.fn();
vi.mock('../../api/contact', () => ({
  submitContact: (...args: unknown[]) => submitContact(...args),
}));

function renderForm() {
  return render(
    <MemoryRouter>
      <ContactNoteForm
        initialName="Uche Aduaka"
        initialEmail="info@ucheaduaka.com"
        sentActions={<a href="/app/home">Back to home</a>}
      />
    </MemoryRouter>,
  );
}

describe('ContactNoteForm', () => {
  beforeEach(() => {
    submitContact.mockReset();
  });

  it('sends the prefilled account details with the message', async () => {
    submitContact.mockResolvedValue({ received: true });
    renderForm();

    expect(screen.getByLabelText(/^Name/)).toHaveValue('Uche Aduaka');
    expect(screen.getByLabelText(/^Work email/)).toHaveValue('info@ucheaduaka.com');

    fireEvent.change(screen.getByLabelText(/What is this about/), {
      target: { value: 'Question about my payment' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));

    await waitFor(() =>
      expect(submitContact).toHaveBeenCalledWith({
        email: 'info@ucheaduaka.com',
        firstName: 'Uche',
        lastName: 'Aduaka',
        message: 'Question about my payment',
        organization: undefined,
      }),
    );
    expect(await screen.findByRole('status')).toHaveTextContent('Request received');
    expect(screen.getByText('Back to home')).toBeInTheDocument();
  });

  it('does not send without a message', async () => {
    renderForm();
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));

    expect(
      await screen.findByText('Tell us what this is about, even in one line'),
    ).toBeInTheDocument();
    expect(submitContact).not.toHaveBeenCalled();
  });

  it('shows the error and keeps the form when the send fails', async () => {
    submitContact.mockRejectedValue(new Error('Too many requests'));
    renderForm();
    fireEvent.change(screen.getByLabelText(/What is this about/), { target: { value: 'Hi' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Too many requests');
    expect(screen.getByRole('button', { name: 'Send' })).toBeInTheDocument();
  });
});
