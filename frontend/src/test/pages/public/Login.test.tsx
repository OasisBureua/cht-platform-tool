import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Login from '../../../pages/public/Login';

const mockLogin = vi.fn();
vi.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: null,
    isAuthenticated: false,
    isLoading: false,
    login: mockLogin,
    completeMfaLogin: vi.fn(),
    completeMfaSetupLogin: vi.fn(),
    signUp: vi.fn(),
    resetPasswordForEmail: vi.fn(),
    logout: vi.fn(),
    getAuthHeaders: vi.fn(),
  }),
}));

function renderLogin() {
  return render(
    <MemoryRouter>
      <Login />
    </MemoryRouter>,
  );
}

describe('Login', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders login form with email and password fields', () => {
    renderLogin();

    expect(screen.getByPlaceholderText(/johndoe@gmail.com/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/••••••••/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
  });

  it('calls login with email and password on form submit', async () => {
    mockLogin.mockResolvedValue({});

    renderLogin();

    fireEvent.change(screen.getByPlaceholderText(/johndoe@gmail.com/i), {
      target: { value: 'test@example.com' },
    });
    fireEvent.change(screen.getByPlaceholderText(/••••••••/), {
      target: { value: 'password123' },
    });
    fireEvent.submit(screen.getByRole('button', { name: /sign in/i }).closest('form')!);

    await screen.findByText(/signing in/i);

    expect(mockLogin).toHaveBeenCalledWith('test@example.com', 'password123', undefined);
  });

  it('shows error message when login fails', async () => {
    mockLogin.mockResolvedValue({ error: { message: 'Invalid credentials' } });

    renderLogin();

    fireEvent.change(screen.getByPlaceholderText(/johndoe@gmail.com/i), {
      target: { value: 'test@example.com' },
    });
    fireEvent.change(screen.getByPlaceholderText(/••••••••/), {
      target: { value: 'wrongpass' },
    });
    fireEvent.submit(screen.getByRole('button', { name: /sign in/i }).closest('form')!);

    expect(await screen.findByText(/invalid credentials/i)).toBeInTheDocument();
  });

  it('shows MFA enrollment QR when login returns MFA_SETUP', async () => {
    mockLogin.mockResolvedValue({
      mfaSetup: {
        session: 'setup-session',
        secretCode: 'SECRETBASE32',
        otpauthUri: 'otpauth://totp/test@example.com?secret=SECRETBASE32',
      },
    });

    renderLogin();

    fireEvent.change(screen.getByPlaceholderText(/johndoe@gmail.com/i), {
      target: { value: 'test@example.com' },
    });
    fireEvent.change(screen.getByPlaceholderText(/••••••••/), {
      target: { value: 'password123' },
    });
    fireEvent.submit(screen.getByRole('button', { name: /sign in/i }).closest('form')!);

    expect(await screen.findByText(/set up authenticator mfa/i)).toBeInTheDocument();
    expect(screen.getByTitle('MFA setup QR code')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /verify and continue/i })).toBeInTheDocument();
  });

  it('links to email verification when the account is unconfirmed', async () => {
    mockLogin.mockResolvedValue({
      error: {
        message: 'Please verify your email before signing in. Check your inbox for a code, or request a new one.',
        code: 'EMAIL_NOT_VERIFIED',
      },
    });

    renderLogin();

    fireEvent.change(screen.getByPlaceholderText(/johndoe@gmail.com/i), {
      target: { value: 'test@example.com' },
    });
    fireEvent.change(screen.getByPlaceholderText(/••••••••/), {
      target: { value: 'password123' },
    });
    fireEvent.submit(screen.getByRole('button', { name: /sign in/i }).closest('form')!);

    const link = await screen.findByRole('link', { name: /verify your email/i });
    expect(link).toHaveAttribute(
      'href',
      '/verify-email?email=test%40example.com',
    );
  });
});
