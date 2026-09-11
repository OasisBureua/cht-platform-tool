import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { adminApi, type AdminUser } from '../../api/admin';
import { useAuth } from '../../contexts/AuthContext';
import { Search, Trash2, X, Loader2 } from 'lucide-react';

const ROLE_COLORS: Record<string, string> = {
  HCP: 'bg-blue-100 text-blue-800',
  KOL: 'bg-purple-100 text-purple-800',
  ADMIN: 'bg-amber-100 text-warning',
};

export default function AdminUsers() {
  const queryClient = useQueryClient();
  const { user: currentUser } = useAuth();
  const [pendingDeleteUser, setPendingDeleteUser] = useState<AdminUser | null>(null);
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<'name' | 'email' | 'npi' | 'role'>('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['admin', 'users', search],
    queryFn: () => adminApi.getUsers(search.trim() ? { q: search.trim() } : undefined),
  });

  const sortedUsers = [...users].sort((a, b) => {
    const dir = sortDir === 'asc' ? 1 : -1;
    const nameOf = (u: AdminUser) => [u.firstName, u.lastName].filter(Boolean).join(' ') || u.email;
    switch (sortKey) {
      case 'email':
        return a.email.localeCompare(b.email) * dir;
      case 'npi':
        return (a.npiNumber ?? '').localeCompare(b.npiNumber ?? '') * dir;
      case 'role':
        return a.role.localeCompare(b.role) * dir;
      case 'name':
      default:
        return nameOf(a).localeCompare(nameOf(b)) * dir;
    }
  });

  function toggleSort(key: typeof sortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  }

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
      setPendingDeleteUser(null);
    },
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground">User Management</h1>
        <p className="text-sm text-muted-foreground mt-1">
          View users, promote to KOL or Admin, or delete HCP/KOL accounts. Admin accounts cannot be removed here. Admins use
          /admin/login to sign in.
        </p>
      </div>

      <div className="bg-card rounded-card border border-border p-6">
        <div className="flex items-center gap-2 mb-4">
          <Search className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold text-foreground">All Users</h2>
        </div>

        <div className="mb-4">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, email, or NPI..."
            className="w-full max-w-sm rounded-lg border border-border px-3 py-2 text-sm focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
          />
        </div>

        {isLoading ? (
          <div className="py-8 text-center text-muted-foreground">Loading users...</div>
        ) : sortedUsers.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">
            {search.trim() ? 'No users match your search.' : 'No users yet.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-border">
              <thead>
                <tr>
                  <SortableHeader label="Name" sortKey="name" activeKey={sortKey} dir={sortDir} onClick={toggleSort} />
                  <SortableHeader label="Email" sortKey="email" activeKey={sortKey} dir={sortDir} onClick={toggleSort} />
                  <SortableHeader label="NPI" sortKey="npi" activeKey={sortKey} dir={sortDir} onClick={toggleSort} />
                  <SortableHeader label="Role" sortKey="role" activeKey={sortKey} dir={sortDir} onClick={toggleSort} />
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {sortedUsers.map((user) => (
                  <UserRow
                    key={user.id}
                    user={user}
                    onRoleChange={(role) => updateRole.mutate({ userId: user.id, role })}
                    isUpdating={updateRole.isPending}
                    onDeleteRequest={() => setPendingDeleteUser(user)}
                    isDeleting={deleteUser.isPending && deleteUser.variables === user.id}
                    isSelf={currentUser?.userId === user.id}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {pendingDeleteUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-card bg-card p-6 shadow-card-hover space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="font-semibold text-foreground">Delete user?</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Permanently delete <strong className="text-muted-foreground">{pendingDeleteUser.email}</strong>? This cannot be
                  undone. Their enrollments and registrations will be removed.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPendingDeleteUser(null)}
                disabled={deleteUser.isPending}
                className="shrink-0 text-muted-foreground hover:text-foreground disabled:opacity-50"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => setPendingDeleteUser(null)}
                disabled={deleteUser.isPending}
                className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => deleteUser.mutate(pendingDeleteUser.id)}
                disabled={deleteUser.isPending}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50 inline-flex items-center gap-2"
              >
                {deleteUser.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />}
                Delete user
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SortableHeader<K extends string>({
  label,
  sortKey,
  activeKey,
  dir,
  onClick,
}: {
  label: string;
  sortKey: K;
  activeKey: K;
  dir: 'asc' | 'desc';
  onClick: (key: K) => void;
}) {
  const isActive = activeKey === sortKey;
  return (
    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
      <button
        type="button"
        onClick={() => onClick(sortKey)}
        className="inline-flex items-center gap-1 hover:text-foreground"
      >
        {label}
        <span className="text-muted-foreground">{isActive ? (dir === 'asc' ? '↑' : '↓') : ''}</span>
      </button>
    </th>
  );
}

function UserRow({
  user,
  onRoleChange,
  isUpdating,
  onDeleteRequest,
  isDeleting,
  isSelf,
}: {
  user: AdminUser;
  onRoleChange: (role: 'HCP' | 'KOL' | 'ADMIN') => void;
  isUpdating: boolean;
  onDeleteRequest: () => void;
  isDeleting: boolean;
  isSelf: boolean;
}) {
  const name = [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email;
  const canDelete = user.role !== 'ADMIN' && !isSelf;

  return (
    <tr>
      <td className="px-4 py-3 text-sm font-medium text-foreground">{name}</td>
      <td className="px-4 py-3 text-sm text-muted-foreground">{user.email}</td>
      <td className="px-4 py-3 text-sm text-muted-foreground max-w-[8rem] truncate" title={user.npiNumber ?? undefined}>
        {user.npiNumber || '—'}
      </td>
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
            className="rounded-lg border border-border px-3 py-1.5 text-sm focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900 disabled:opacity-50"
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
              onClick={() => onDeleteRequest()}
              className="inline-flex items-center justify-center rounded-lg border border-destructive/25 bg-destructive/10 p-2 text-destructive hover:bg-red-100 disabled:opacity-50"
              aria-label={`Delete user ${user.email}`}
            >
              <Trash2 className="h-4 w-4" />
            </button>
          ) : (
            <span className="text-xs text-muted-foreground">, </span>
          )}
        </div>
      </td>
    </tr>
  );
}
