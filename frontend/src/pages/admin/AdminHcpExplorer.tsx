import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, Download, Loader2, Users } from 'lucide-react';
import { adminApi, type AdminUser } from '../../api/admin';

function getInitials(firstName: string, lastName: string, email: string): string {
  if (firstName && lastName) return (firstName[0] + lastName[0]).toUpperCase();
  if (firstName) return firstName.slice(0, 2).toUpperCase();
  if (email) return email.slice(0, 2).toUpperCase();
  return 'U';
}

const ROLE_COLORS: Record<string, string> = {
  ADMIN: 'bg-purple-100 text-purple-800',
  KOL:   'bg-blue-100 text-blue-800',
  HCP:   'bg-green-100 text-green-800',
};

const STATUS_COLORS: Record<string, string> = {
  ACTIVE:    'bg-green-100 text-green-800',
  INACTIVE:  'bg-gray-100 text-gray-600',
  SUSPENDED: 'bg-red-100 text-red-700',
};

const ROLES = ['All', 'HCP', 'KOL', 'ADMIN'];

export default function AdminHcpExplorer() {
  const [inputValue, setInputValue] = useState('');
  const [roleFilter, setRoleFilter] = useState('All');

  // Debounced query - only fires backend request after 400 ms idle
  const [debouncedQuery, setDebouncedQuery] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(inputValue.trim()), 400);
    return () => clearTimeout(t);
  }, [inputValue]);

  const { data: users = [], isLoading, isFetching, isError } = useQuery({
    queryKey: ['admin', 'users', debouncedQuery, roleFilter],
    queryFn: () =>
      adminApi.getUsers({
        q: debouncedQuery || undefined,
        role: roleFilter !== 'All' ? roleFilter : undefined,
        limit: 100,
      }),
    staleTime: 30 * 1000,
  });

  const handleExport = () => {
    const rows = [
      ['Name', 'Email', 'Role', 'Status', 'Joined'],
      ...users.map((u) => [
        `${u.firstName} ${u.lastName}`.trim(),
        u.email,
        u.role,
        u.status,
        new Date(u.createdAt).toLocaleDateString(),
      ]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'hcp-users.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const isSearching = isFetching && !isLoading;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">HCP Profile Explorer</h1>
        <p className="text-sm text-gray-600 mt-1">
          Search and manage Healthcare Professional profiles. Results are fetched live from the database.
        </p>
      </div>

      {/* Search + filter bar */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Search className="h-5 w-5 text-gray-700" />
            <h2 className="text-base font-semibold text-gray-900">Profile Lookup</h2>
            {!isLoading && (
              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-500">
                {users.length} result{users.length !== 1 ? 's' : ''}
              </span>
            )}
            {isSearching && (
              <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
            )}
          </div>
          <button
            onClick={handleExport}
            disabled={users.length === 0}
            className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-900 inline-flex items-center gap-2 hover:bg-gray-50 disabled:opacity-40 transition-colors"
          >
            <Download className="h-4 w-4" /> Export CSV
          </button>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="search"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Search by name or email…"
              className="w-full rounded-xl border border-gray-200 pl-11 pr-4 py-2.5 text-sm focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
            />
          </div>
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-900 sm:w-44 focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
          >
            {ROLES.map((r) => (
              <option key={r} value={r}>{r === 'All' ? 'All Roles' : r}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Results */}
      {isLoading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      ) : isError ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-8 text-center">
          <p className="font-semibold text-red-700">Failed to load users</p>
          <p className="text-sm text-red-600 mt-1">Check your connection or try refreshing.</p>
        </div>
      ) : users.length === 0 ? (
        <div className="rounded-2xl border border-gray-200 bg-white p-12 text-center">
          <Users className="h-10 w-10 text-gray-300 mx-auto mb-3" />
          <p className="font-semibold text-gray-900">
            {debouncedQuery || roleFilter !== 'All' ? 'No users found' : 'No users yet'}
          </p>
          <p className="text-sm text-gray-500 mt-1">
            {debouncedQuery || roleFilter !== 'All'
              ? 'Try a different search term or filter.'
              : 'Users will appear here once they register.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {users.map((user) => (
            <UserRow key={user.id} user={user} />
          ))}
        </div>
      )}
    </div>
  );
}

function UserRow({ user }: { user: AdminUser }) {
  const initials = getInitials(user.firstName, user.lastName, user.email);
  const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ') || '-';
  const joined = new Date(user.createdAt).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <div className="bg-white rounded-2xl border border-gray-200 px-5 py-4 flex items-center gap-4">
      {/* Avatar */}
      <div className="h-12 w-12 rounded-full bg-gray-900 flex items-center justify-center shrink-0">
        <span className="text-sm font-bold text-white">{initials}</span>
      </div>

      {/* Info */}
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-gray-900 truncate">{fullName}</p>
        <p className="text-sm text-gray-500 truncate">{user.email}</p>
      </div>

      {/* Joined */}
      <div className="hidden sm:flex items-center shrink-0 text-xs text-gray-400">
        Joined {joined}
      </div>

      {/* Badges */}
      <div className="flex items-center gap-2 shrink-0">
        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${ROLE_COLORS[user.role] ?? 'bg-gray-100 text-gray-700'}`}>
          {user.role}
        </span>
        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_COLORS[user.status] ?? 'bg-gray-100 text-gray-700'}`}>
          {user.status}
        </span>
      </div>
    </div>
  );
}
