import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { adminApi, type AdminUser } from '../../api/admin';
import { useAuth } from '../../contexts/AuthContext';
import { Search, Trash2, X, Loader2 } from 'lucide-react';
import { isSuperAdmin, type PlatformRole } from '../../utils/roles';
import { AdminDomainAccessPanel } from '../../components/admin/AdminDomainAccessPanel';

const ROLE_COLORS: Record<string, string> = {
  HCP: 'bg-blue-100 text-blue-800',
  KOL: 'bg-purple-100 text-purple-800',
  ADMIN: 'bg-amber-100 text-warning',
  SUPER_ADMIN: 'bg-rose-100 text-rose-800',
};

const ROLE_FILTERS: Array<{ value: '' | PlatformRole; label: string }> = [
  { value: '', label: 'All roles' },
  { value: 'HCP', label: 'HCP' },
  { value: 'KOL', label: 'KOL' },
  { value: 'ADMIN', label: 'Admin' },
  { value: 'SUPER_ADMIN', label: 'Super Admin' },
];

const STATUS_FILTERS = [
  { value: '', label: 'All statuses' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'INACTIVE', label: 'Inactive' },
  { value: 'SUSPENDED', label: 'Suspended' },
] as const;

function roleLabel(role: string): string {
  return role === 'SUPER_ADMIN' ? 'Super Admin' : role;
}

export default function AdminUsers() {
  const queryClient = useQueryClient();
  const { user: currentUser } = useAuth();
  const actorIsSuper = isSuperAdmin(currentUser?.role);
  const [pendingDeleteUser, setPendingDeleteUser] = useState<AdminUser | null>(null);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<'' | PlatformRole>('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sortKey, setSortKey] = useState<'name' | 'email' | 'npi' | 'role' | 'status'>('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedSearch(search.trim()), 250);
    return () => window.clearTimeout(t);
  }, [search]);

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['admin', 'users', debouncedSearch, roleFilter, statusFilter],
    queryFn: () =>
      adminApi.getUsers({
        q: debouncedSearch || undefined,
        role: roleFilter || undefined,
        status: statusFilter || undefined,
        limit: 200,
      }),
  });

  const roleCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const u of users) {
      counts[u.role] = (counts[u.role] ?? 0) + 1;
    }
    return counts;
  }, [users]);

  const sortedUsers = useMemo(() => {
    const dir = sortDir === 'asc' ? 1 : -1;
    const nameOf = (u: AdminUser) =>
      [u.firstName, u.lastName].filter(Boolean).join(' ') || u.email;
    return [...users].sort((a, b) => {
      switch (sortKey) {
        case 'email':
          return a.email.localeCompare(b.email) * dir;
        case 'npi':
          return (a.npiNumber ?? '').localeCompare(b.npiNumber ?? '') * dir;
        case 'role':
          return a.role.localeCompare(b.role) * dir;
        case 'status':
          return (a.status ?? '').localeCompare(b.status ?? '') * dir;
        case 'name':
        default:
          return nameOf(a).localeCompare(nameOf(b)) * dir;
      }
    });
  }, [users, sortKey, sortDir]);

  function toggleSort(key: typeof sortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  }

  const updateRole = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: PlatformRole }) =>
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

  const hasActiveFilters = Boolean(debouncedSearch || roleFilter || statusFilter);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground">User Management</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {actorIsSuper
            ? 'Search and filter users, promote roles, grant domain write access, and delete accounts when needed.'
            : 'Search and filter users. Only a Super Admin can promote roles, grant write domains, or delete admin accounts.'}
        </p>
      </div>

      {actorIsSuper ? <AdminDomainAccessPanel /> : null}

      <div className="bg-card rounded-card border border-border p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Search className="h-5 w-5 text-muted-foreground" />
            <h2 className="text-lg font-semibold text-foreground">All Users</h2>
            <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-semibold text-muted-foreground">
              {users.length}
              {users.length >= 200 ? '+' : ''} shown
            </span>
          </div>
          {hasActiveFilters ? (
            <button
              type="button"
              onClick={() => {
                setSearch('');
                setDebouncedSearch('');
                setRoleFilter('');
                setStatusFilter('');
              }}
              className="text-sm font-semibold text-blue-600 hover:text-blue-800 hover:underline"
            >
              Clear filters
            </button>
          ) : null}
        </div>

        <div className="mb-4 flex flex-col gap-3">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, email, or NPI..."
            className="w-full max-w-md rounded-lg border border-border px-3 py-2 text-sm focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
          />

          <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filter by role">
            {ROLE_FILTERS.map((f) => {
              const active = roleFilter === f.value;
              const count =
                f.value === ''
                  ? undefined
                  : roleCounts[f.value];
              return (
                <button
                  key={f.value || 'all'}
                  type="button"
                  onClick={() => setRoleFilter(f.value)}
                  className={[
                    'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors',
                    active
                      ? 'border-gray-900 bg-gray-900 text-white'
                      : 'border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground',
                  ].join(' ')}
                >
                  {f.label}
                  {typeof count === 'number' ? (
                    <span className={active ? 'text-white/80' : 'text-muted-foreground'}>
                      {count}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filter by status">
            {STATUS_FILTERS.map((f) => {
              const active = statusFilter === f.value;
              return (
                <button
                  key={f.value || 'all-status'}
                  type="button"
                  onClick={() => setStatusFilter(f.value)}
                  className={[
                    'inline-flex items-center rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors',
                    active
                      ? 'border-blue-700 bg-blue-700 text-white'
                      : 'border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground',
                  ].join(' ')}
                >
                  {f.label}
                </button>
              );
            })}
          </div>
        </div>

        {isLoading ? (
          <div className="py-8 text-center text-muted-foreground">Loading users...</div>
        ) : sortedUsers.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">
            {hasActiveFilters ? 'No users match your filters.' : 'No users yet.'}
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
                  <SortableHeader label="Status" sortKey="status" activeKey={sortKey} dir={sortDir} onClick={toggleSort} />
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {sortedUsers.map((user) => (
                  <UserRow
                    key={user.id}
                    user={user}
                    actorIsSuper={actorIsSuper}
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
                  Permanently delete{' '}
                  <strong className="text-muted-foreground">{pendingDeleteUser.email}</strong>? This
                  cannot be undone. Their enrollments and registrations will be removed.
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
  actorIsSuper,
  onRoleChange,
  isUpdating,
  onDeleteRequest,
  isDeleting,
  isSelf,
}: {
  user: AdminUser;
  actorIsSuper: boolean;
  onRoleChange: (role: PlatformRole) => void;
  isUpdating: boolean;
  onDeleteRequest: () => void;
  isDeleting: boolean;
  isSelf: boolean;
}) {
  const name = [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email;
  const targetIsElevated = user.role === 'ADMIN' || user.role === 'SUPER_ADMIN';
  const canDelete = !isSelf && (!targetIsElevated || actorIsSuper);

  return (
    <tr>
      <td className="px-4 py-3 text-sm font-medium text-foreground">{name}</td>
      <td className="px-4 py-3 text-sm text-muted-foreground">{user.email}</td>
      <td className="px-4 py-3 text-sm text-muted-foreground max-w-[8rem] truncate" title={user.npiNumber ?? undefined}>
        {user.npiNumber || '—'}
      </td>
      <td className="px-4 py-3">
        {actorIsSuper && !isSelf ? (
          <select
            value={user.role}
            onChange={(e) => onRoleChange(e.target.value as PlatformRole)}
            disabled={isUpdating || isDeleting}
            className="rounded-lg border border-border px-3 py-1.5 text-sm focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900 disabled:opacity-50"
            aria-label={`Change role for ${user.email}`}
          >
            <option value="HCP">HCP</option>
            <option value="KOL">KOL</option>
            <option value="ADMIN">Admin</option>
            <option value="SUPER_ADMIN">Super Admin</option>
          </select>
        ) : (
          <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${ROLE_COLORS[user.role] || 'bg-gray-100 text-gray-800'}`}>
            {roleLabel(user.role)}
            {isSelf ? ' (you)' : ''}
          </span>
        )}
      </td>
      <td className="px-4 py-3">
        <span className="text-xs font-medium text-muted-foreground">{user.status || '—'}</span>
      </td>
      <td className="px-4 py-3">
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
        ) : null}
      </td>
    </tr>
  );
}
