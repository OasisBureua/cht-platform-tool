import { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, Download, Loader2, Users, ChevronDown, ChevronUp } from 'lucide-react';
import { adminApi, type AdminUser } from '../../api/admin';
import { US_STATES, normalizeUsStateCode, usStateLabel } from '../../data/us-states';

function getInitials(firstName: string, lastName: string, email: string): string {
  if (firstName && lastName) return (firstName[0] + lastName[0]).toUpperCase();
  if (firstName) return firstName.slice(0, 2).toUpperCase();
  if (email) return email.slice(0, 2).toUpperCase();
  return 'U';
}

const ROLE_COLORS: Record<string, string> = {
  ADMIN: 'bg-purple-100 text-purple-800',
  KOL: 'bg-blue-100 text-blue-800',
  HCP: 'bg-green-100 text-green-800',
};

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: 'bg-green-100 text-green-800',
  INACTIVE: 'bg-gray-100 text-gray-600',
  SUSPENDED: 'bg-red-100 text-red-700',
};

const ROLES = ['All', 'HCP', 'KOL', 'ADMIN'];

export default function AdminHcpExplorer() {
  const [inputValue, setInputValue] = useState('');
  const [roleFilter, setRoleFilter] = useState('All');

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

  const kolGrouped = useMemo(() => {
    if (roleFilter !== 'KOL') return null;
    const map = new Map<string, AdminUser[]>();
    for (const u of users) {
      const code = normalizeUsStateCode(u.state) ?? 'UNKNOWN';
      if (!map.has(code)) map.set(code, []);
      map.get(code)!.push(u);
    }
    const order = [
      ...US_STATES.map((s) => s.value),
      ...(map.has('UNKNOWN') ? ['UNKNOWN'] : []),
    ];
    return order
      .filter((code) => map.has(code))
      .map((code) => ({
        state: code,
        stateLabel: code === 'UNKNOWN' ? 'State unknown' : usStateLabel(code),
        users: map.get(code)!.sort((a, b) => {
          const an = `${a.firstName} ${a.lastName}`.trim().toLowerCase();
          const bn = `${b.firstName} ${b.lastName}`.trim().toLowerCase();
          return an.localeCompare(bn);
        }),
      }));
  }, [users, roleFilter]);

  const handleExport = () => {
    const rows = [
      ['Name', 'Email', 'Role', 'Status', 'State', 'Joined'],
      ...users.map((u) => [
        `${u.firstName} ${u.lastName}`.trim(),
        u.email,
        u.role,
        u.status,
        u.state?.trim() || '',
        new Date(u.createdAt).toLocaleDateString(),
      ]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
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
          Search and manage Healthcare Professional profiles. KOLs can be grouped by state; expand a row to see paid
          payouts.
        </p>
      </div>

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
            {isSearching && <Loader2 className="h-4 w-4 animate-spin text-gray-400" />}
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
              <option key={r} value={r}>
                {r === 'All' ? 'All Roles' : r}
              </option>
            ))}
          </select>
        </div>
      </div>

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
          {roleFilter === 'KOL' && kolGrouped
            ? kolGrouped.map(({ state, stateLabel, users: group }) => (
                <div key={state} className="space-y-2">
                  <h3 className="text-xs font-bold uppercase tracking-wide text-gray-500 px-1">
                    {stateLabel}
                  </h3>
                  <div className="space-y-3">
                    {group.map((user) => (
                      <UserRow key={user.id} user={user} compactState />
                    ))}
                  </div>
                </div>
              ))
            : users.map((user) => <UserRow key={user.id} user={user} />)}
        </div>
      )}
    </div>
  );
}

function formatPaidUsd(cents: number) {
  return `$${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function UserRow({ user, compactState }: { user: AdminUser; compactState?: boolean }) {
  const [open, setOpen] = useState(false);
  const initials = getInitials(user.firstName, user.lastName, user.email);
  const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ') || '-';
  const joined = new Date(user.createdAt).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  const { data: payments = [], isFetching } = useQuery({
    queryKey: ['admin', 'user-payments', user.id],
    queryFn: () => adminApi.getUserPaidPayments(user.id),
    enabled: open,
  });

  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
      <div className="px-5 py-4 flex items-center gap-4">
        <div className="h-12 w-12 rounded-full bg-brand-600 flex items-center justify-center shrink-0">
          <span className="text-sm font-bold text-white">{initials}</span>
        </div>

        <div className="min-w-0 flex-1">
          <p className="font-semibold text-gray-900 truncate">{fullName}</p>
          <p className="text-sm text-gray-500 truncate">
            {user.email}
            {!compactState && user.state?.trim() ? (
              <span className="text-gray-400"> · {user.state.trim()}</span>
            ) : null}
          </p>
        </div>

        <div className="hidden sm:flex items-center shrink-0 text-xs text-gray-400">
          Joined {joined}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span
            className={`rounded-full px-2.5 py-1 text-xs font-semibold ${ROLE_COLORS[user.role] ?? 'bg-gray-100 text-gray-700'}`}
          >
            {user.role}
          </span>
          <span
            className={`rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_COLORS[user.status] ?? 'bg-gray-100 text-gray-700'}`}
          >
            {user.status}
          </span>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="rounded-lg border border-gray-200 p-2 text-gray-600 hover:bg-gray-50 transition-colors"
            aria-expanded={open}
            aria-label={open ? 'Hide payments' : 'Show payments'}
          >
            {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {open ? (
        <div className="border-t border-gray-100 bg-gray-50 px-5 py-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">Successful payments</p>
          {isFetching ? (
            <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
          ) : payments.length === 0 ? (
            <p className="text-sm text-gray-600">No paid payouts recorded for this user.</p>
          ) : (
            <ul className="space-y-2">
              {payments.map((p) => (
                <li
                  key={p.id}
                  className="flex flex-wrap items-baseline justify-between gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs text-gray-800"
                >
                  <span className="font-semibold text-gray-900">{formatPaidUsd(p.amount)}</span>
                  <span className="text-gray-600">{p.type.replace(/_/g, ' ')}</span>
                  <span className="text-gray-500 w-full sm:w-auto">
                    {p.program?.title ?? '-'}
                    {p.paidAt ? ` · Paid ${new Date(p.paidAt).toLocaleDateString()}` : ''}
                  </span>
                  {p.description?.trim() ? (
                    <span className="text-gray-400 w-full">{p.description.trim()}</span>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
