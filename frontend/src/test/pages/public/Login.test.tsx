import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Login from '../../../pages/public/Login';

const mockLogin = vi.fn();
vi.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => ({
    isAuthenticated: false,
    login: mockLogin,
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
    expect(screen.getByRole('button', { name: /login/i })).toBeInTheDocument();
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
    fireEvent.submit(screen.getByRole('button', { name: /login/i }).closest('form')!);

    await screen.findByText(/signing in/i);

    expect(mockLogin).toHaveBeenCalledWith('test@example.com', 'password123');
  });

  it('shows error message when login fails', async () => {
    mockLogin.mockResolvedValue({ error: { message: 'Invalid credentials' } });

    renderLogin();

    fireEvent.change(screen.getByPlaceholderText(/johndoe@gmail.com/i), {
      target: { value: 'test@example.com' },
    });
    fireEvent.change(screen.getByPlaceholderText(/••••••••/), {
      target: { value: 'wrong' },
    });
    fireEvent.submit(screen.getByRole('button', { name: /login/i }).closest('form')!);

    expect(await screen.findByText(/invalid credentials/i)).toBeInTheDocument();
  });
});
