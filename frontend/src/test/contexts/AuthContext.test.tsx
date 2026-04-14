import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { AuthProvider, useAuth } from '../../contexts/AuthContext';

vi.mock('../../api/client', () => ({
  setAuthHeaderGetter: vi.fn(),
  setUnauthorizedHandler: vi.fn(),
}));

describe('AuthContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    if (typeof localStorage?.clear === 'function') localStorage.clear();
    vi.stubEnv('VITE_DISABLE_AUTH', 'false');
  });

  it('useAuth throws when used outside AuthProvider', () => {
    expect(() => {
      function BadComponent() {
        useAuth();
        return null;
      }
      render(<BadComponent />);
    }).toThrow('useAuth must be used within AuthProvider');
  });

  it('AuthProvider renders children and provides auth context', async () => {
    function TestChild() {
      const auth = useAuth();
      return (
        <div>
          <span data-testid="loading">{String(auth.isLoading)}</span>
          <span data-testid="authenticated">{String(auth.isAuthenticated)}</span>
        </div>
      );
    }

    render(
      <AuthProvider>
        <TestChild />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toBeInTheDocument();
    });

    await waitFor(() => {
      const loading = screen.getByTestId('loading');
      expect(loading.textContent).toBe('false');
    });

    expect(screen.getByTestId('authenticated').textContent).toBe('false');
  });
});
