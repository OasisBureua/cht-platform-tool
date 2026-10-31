import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ProgramAttendancePanel } from '../../components/admin/ProgramAttendancePanel';
import { adminCapabilityDeniedMessage } from '../../utils/admin-capabilities';
import type { ProgramRegistrationAdminRow } from '../../api/admin';

let mockUser: {
  userId: string;
  role: string;
  capabilities?: string[];
} | null = null;

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ user: mockUser }),
}));

vi.mock('../../api/admin', () => ({
  adminApi: {
    updatePostEventAttendance: vi.fn(),
  },
}));

const registration = {
  id: 'reg-1',
  status: 'APPROVED',
  postEventAttendanceStatus: 'PENDING_VERIFICATION',
  postEventAttendanceReviewedAt: null,
  zoomJoined: false,
  zoomParticipantEmail: null,
  user: {
    id: 'u1',
    email: 'learner@example.com',
    firstName: 'Lee',
    lastName: 'Ner',
  },
} as unknown as ProgramRegistrationAdminRow;

function renderPanel() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <ProgramAttendancePanel
        programId="prog-1"
        registrations={[registration]}
      />
    </QueryClientProvider>,
  );
}

describe('ProgramAttendancePanel capability gates', () => {
  beforeEach(() => {
    mockUser = {
      userId: 'admin-1',
      role: 'ADMIN',
      capabilities: [],
    };
  });

  it('disables Verify / Missed when admin lacks programs write', () => {
    renderPanel();
    const denied = adminCapabilityDeniedMessage('programs');

    const verify = screen.getByRole('button', { name: /^Verify$/i });
    const missed = screen.getByRole('button', { name: /^Missed$/i });
    expect(verify).toBeDisabled();
    expect(missed).toBeDisabled();
    expect(verify).toHaveAttribute('title', denied);
    expect(missed).toHaveAttribute('title', denied);

    expect(screen.getByRole('button', { name: /Verify attendance/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Mark missed/i })).toBeDisabled();
  });

  it('enables Verify / Missed when admin has programs write', () => {
    mockUser = {
      userId: 'admin-1',
      role: 'ADMIN',
      capabilities: ['programs'],
    };
    renderPanel();

    expect(screen.getByRole('button', { name: /^Verify$/i })).not.toBeDisabled();
    expect(screen.getByRole('button', { name: /^Missed$/i })).not.toBeDisabled();
  });

  it('enables overrides for Super Admin without domain list', () => {
    mockUser = { userId: 'super-1', role: 'SUPER_ADMIN', capabilities: [] };
    renderPanel();

    expect(screen.getByRole('button', { name: /^Verify$/i })).not.toBeDisabled();
    expect(screen.getByRole('button', { name: /^Missed$/i })).not.toBeDisabled();
  });
});
