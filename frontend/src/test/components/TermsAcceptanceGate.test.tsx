import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ProtectedRoute from '../../components/ProtectedRoute';
import TermsDeclinedNotice from '../../components/TermsDeclinedNotice';
import { TERMS_DECLINED_KEY } from '../../lib/terms-consent';

const mockRefreshProfile = vi.fn();
const mockLogout = vi.fn();
const mockAccept = vi.fn();
const mockDecline = vi.fn();
let mockUser: Record<string, unknown> | null = null;

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: mockUser,
    isAuthenticated: !!mockUser,
    isLoading: false,
    refreshProfile: mockRefreshProfile,
    logout: mockLogout,
  }),
}));

vi.mock('../../api/terms', () => ({
  termsApi: {
    accept: (version: string) => mockAccept(version),
    decline: () => mockDecline(),
  },
}));

function renderGate() {
  return render(
    <MemoryRouter>
      <ProtectedRoute>
        <div>Dashboard content</div>
      </ProtectedRoute>
    </MemoryRouter>,
  );
}

describe('Terms acceptance gate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    mockUser = { userId: 'u1', role: 'HCP', termsAccepted: false, termsVersion: '2026-09-29' };
  });

  it('blocks protected content until terms are accepted', () => {
    renderGate();

    expect(screen.getByRole('dialog', { name: /terms of service & privacy policy confirmation/i })).toBeInTheDocument();
    expect(screen.queryByText('Dashboard content')).not.toBeInTheDocument();
  });

  it('links to the full documents in a new tab', () => {
    renderGate();

    const terms = screen.getByRole('link', { name: /terms and conditions/i });
    const privacy = screen.getByRole('link', { name: /privacy policy/i });
    expect(terms).toHaveAttribute('href', '/terms');
    expect(terms).toHaveAttribute('target', '_blank');
    expect(privacy).toHaveAttribute('href', '/privacy');
    expect(privacy).toHaveAttribute('target', '_blank');
  });

  it('requires the checkbox, then saves the displayed version and refreshes the profile', async () => {
    mockAccept.mockResolvedValue({ termsAccepted: true });
    renderGate();

    const accept = screen.getByRole('button', { name: /accept and continue/i });
    expect(accept).toBeDisabled();

    fireEvent.click(screen.getByRole('checkbox'));
    expect(accept).toBeEnabled();
    fireEvent.click(accept);

    await waitFor(() => expect(mockRefreshProfile).toHaveBeenCalled());
    expect(mockAccept).toHaveBeenCalledWith('2026-09-29');
    expect(mockLogout).not.toHaveBeenCalled();
  });

  it('declining records the decline, flags the notice and signs out', async () => {
    mockDecline.mockResolvedValue(undefined);
    renderGate();

    fireEvent.click(screen.getByRole('button', { name: /decline and sign out/i }));

    await waitFor(() => expect(mockLogout).toHaveBeenCalled());
    expect(mockDecline).toHaveBeenCalled();
    expect(sessionStorage.getItem(TERMS_DECLINED_KEY)).toBe('1');
  });

  it('closing the modal is treated as declining', async () => {
    renderGate();

    fireEvent.click(screen.getByRole('button', { name: /close and sign out/i }));

    await waitFor(() => expect(mockLogout).toHaveBeenCalled());
  });

  it('renders protected content once terms are accepted', () => {
    mockUser = { userId: 'u1', role: 'HCP', termsAccepted: true };
    renderGate();

    expect(screen.getByText('Dashboard content')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('shows a one-time restricted-access message after a decline', () => {
    sessionStorage.setItem(TERMS_DECLINED_KEY, '1');
    render(
      <MemoryRouter>
        <TermsDeclinedNotice />
      </MemoryRouter>,
    );

    expect(screen.getByRole('status')).toHaveTextContent(/access restricted/i);
    expect(sessionStorage.getItem(TERMS_DECLINED_KEY)).toBeNull();
  });
});
