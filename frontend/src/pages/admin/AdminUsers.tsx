import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminApi, type AdminUser } from '../../api/admin';
import { useAuth } from '../../contexts/AuthContext';
import { Search, Trash2 } from 'lucide-react';

const ROLE_COLORS: Record<string, string> = {
  HCP: 'bg-blue-100 text-blue-800',
  KOL: 'bg-purple-100 text-purple-800',
  ADMIN: 'bg-amber-100 text-amber-800',
};

export default function AdminUsers() {
  const queryClient = useQueryClient();
  const { user: currentUser } = useAuth();
  const { data: users = [], isLoading } = useQuery({
    queryKey: ['admin', 'users'],
    queryFn: () => adminApi.getUsers(),
  });

  const updateRole = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: 'HCP' | 'KOL' | 'ADMIN' }) =>
      adminApi.updateUserRole(userId, role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
    },
  });

  const deleteUser = useMutation({
    mutationFn: (userId: string) => adminApi.deleteUser(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'stats'] });
    },
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
        <p className="text-sm text-gray-600 mt-1">
          View users, promote to KOL or Admin, or delete HCP/KOL accounts. Admin accounts cannot be removed here. Admins use
          /admin/login to sign in.
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Search className="h-5 w-5 text-gray-500" />
          <h2 className="text-lg font-semibold text-gray-900">All Users</h2>
        </div>

        {isLoading ? (
          <div className="py-8 text-center text-gray-500">Loading users...</div>
        ) : users.length === 0 ? (
          <div className="py-8 text-center text-gray-500">No users yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead>
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Role</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {users.map((user) => (
                  <UserRow
                    key={user.id}
                    user={user}
                    onRoleChange={(role) => updateRole.mutate({ userId: user.id, role })}
                    isUpdating={updateRole.isPending}
                    onDelete={() => deleteUser.mutate(user.id)}
                    isDeleting={deleteUser.isPending && deleteUser.variables === user.id}
                    isSelf={currentUser?.userId === user.id}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function UserRow({
  user,
  onRoleChange,
  isUpdating,
  onDelete,
  isDeleting,
  isSelf,
}: {
  user: AdminUser;
  onRoleChange: (role: 'HCP' | 'KOL' | 'ADMIN') => void;
  isUpdating: boolean;
  onDelete: () => void;
  isDeleting: boolean;
  isSelf: boolean;
}) {
  const name = [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email;
  const canDelete = user.role !== 'ADMIN' && !isSelf;

  return (
    <tr>
      <td className="px-4 py-3 text-sm font-medium text-gray-900">{name}</td>
      <td className="px-4 py-3 text-sm text-gray-600">{user.email}</td>
      <td className="px-4 py-3">
        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${ROLE_COLORS[user.role] || 'bg-gray-100 text-gray-800'}`}>
          {user.role}
        </span>
      </td>
      <td className="px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={user.role}
            onChange={(e) => onRoleChange(e.target.value as 'HCP' | 'KOL' | 'ADMIN')}
            disabled={isUpdating || isDeleting}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900 disabled:opacity-50"
          >
            <option value="HCP">HCP</option>
            <option value="KOL">KOL</option>
            <option value="ADMIN">Admin</option>
          </select>
          {canDelete ? (
            <button
              type="button"
              disabled={isUpdating || isDeleting}
              title="Permanently delete this user and related enrollments, registrations, and activity"
              onClick={() => {
                if (
                  !window.confirm(
                    `Delete user ${user.email}? This cannot be undone. Their enrollments and registrations will be removed.`,
                  )
                ) {
                  return;
                }
                onDelete();
              }}
              className="inline-flex items-center justify-center rounded-lg border border-red-200 bg-red-50 p-2 text-red-800 hover:bg-red-100 disabled:opacity-50"
              aria-label={`Delete user ${user.email}`}
            >
              <Trash2 className="h-4 w-4" />
            </button>
          ) : (
            <span className="text-xs text-gray-400">—</span>
          )}
        </div>
      </td>
    </tr>
  );
}
