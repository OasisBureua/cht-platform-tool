import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AdminCapabilityRequestPanel } from '../../components/admin/AdminCapabilityRequestPanel';

let mockUser: {
  userId: string;
  role: string;
  capabilities?: string[];
} | null = null;

const listMock = vi.fn();
const createMock = vi.fn();
const approveMock = vi.fn();
const denyMock = vi.fn();
const cancelMock = vi.fn();

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ user: mockUser }),
}));

vi.mock('../../api/admin', () => ({
  adminApi: {
    listCapabilityAccessRequests: (...args: unknown[]) => listMock(...args),
    createCapabilityAccessRequest: (...args: unknown[]) => createMock(...args),
    approveCapabilityAccessRequest: (...args: unknown[]) => approveMock(...args),
    denyCapabilityAccessRequest: (...args: unknown[]) => denyMock(...args),
    cancelCapabilityAccessRequest: (...args: unknown[]) => cancelMock(...args),
  },
}));

function renderPanel() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <AdminCapabilityRequestPanel />
    </QueryClientProvider>,
  );
}

describe('AdminCapabilityRequestPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listMock.mockResolvedValue([]);
    mockUser = {
      userId: 'admin-1',
      role: 'ADMIN',
      capabilities: ['payments'],
    };
  });

  it('lets an Admin request domains they do not already have', async () => {
    renderPanel();

    expect(
      await screen.findByRole('button', { name: /Send request/i }),
    ).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: /^Programs$/i }));
    expect(screen.getByRole('button', { name: /Send request/i })).not.toBeDisabled();

    createMock.mockResolvedValue({ id: 'req-1' });
    fireEvent.click(screen.getByRole('button', { name: /Send request/i }));

    await waitFor(() => {
      expect(createMock).toHaveBeenCalledWith({
        capabilities: ['programs'],
        note: undefined,
      });
    });
    expect(await screen.findByText(/Request sent to Super Admins/i)).toBeInTheDocument();
  });

  it('shows Super Admin pending queue with Approve / Deny', async () => {
    mockUser = { userId: 'super-1', role: 'SUPER_ADMIN', capabilities: [] };
    listMock.mockResolvedValue([
      {
        id: 'req-1',
        status: 'PENDING',
        capabilities: ['programs'],
        note: 'Need hub',
        createdAt: '2026-10-31T00:00:00.000Z',
        requesterId: 'admin-1',
        requester: {
          id: 'admin-1',
          email: 'admin@example.com',
          firstName: 'Ada',
          lastName: 'Admin',
          role: 'ADMIN',
        },
      },
    ]);

    renderPanel();

    expect(await screen.findByText(/admin@example.com/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Send request/i })).not.toBeInTheDocument();

    const approve = screen.getByRole('button', { name: /^Approve$/i });
    const deny = screen.getByRole('button', { name: /^Deny$/i });
    expect(approve).toBeInTheDocument();
    expect(deny).toBeInTheDocument();

    approveMock.mockResolvedValue({ id: 'req-1', status: 'APPROVED' });
    fireEvent.click(approve);
    await waitFor(() => {
      expect(approveMock).toHaveBeenCalledWith('req-1');
    });
  });
});
