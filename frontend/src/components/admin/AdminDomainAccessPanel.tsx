import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Shield } from 'lucide-react';
import {
  adminApi,
  type AdminDomainCapability,
  type AdminUser,
} from '../../api/admin';
import { getApiErrorMessage } from '../../api/client';
import {
  ADMIN_CAPABILITIES,
  CAPABILITY_TO_COGNITO_GROUP,
  type AdminCapability,
} from '../../utils/admin-capabilities';

const DOMAIN_LABELS: Record<AdminCapability, string> = {
  payments: 'Payments',
  programs: 'Programs',
  surveys: 'Surveys',
  reports: 'Reports',
  content: 'Content',
};

function normalizeCaps(raw: string[] | undefined | null): AdminCapability[] {
  const set = new Set(raw ?? []);
  return ADMIN_CAPABILITIES.filter((c) => set.has(c));
}

/**
 * Super Admin only: grant/revoke Cognito domain write groups for ADMIN users.
 * Matches User Management card/table styling.
 */
export function AdminDomainAccessPanel() {
  const queryClient = useQueryClient();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  /** Optimistic local overrides keyed by userId until list refetch. */
  const [localCaps, setLocalCaps] = useState<Record<string, AdminCapability[]>>(
    {},
  );

  const { data: adminRoleUsers = [], isLoading: loadingAdmins } = useQuery({
    queryKey: ['admin', 'users', 'domain-access', 'ADMIN'],
    queryFn: () => adminApi.getUsers({ role: 'ADMIN', limit: 200 }),
  });
  const { data: superRoleUsers = [], isLoading: loadingSupers } = useQuery({
    queryKey: ['admin', 'users', 'domain-access', 'SUPER_ADMIN'],
    queryFn: () => adminApi.getUsers({ role: 'SUPER_ADMIN', limit: 200 }),
  });

  const adminUsers = useMemo(() => {
    const map = new Map<string, AdminUser>();
    for (const u of [...adminRoleUsers, ...superRoleUsers]) {
      map.set(u.id, u);
    }
    return [...map.values()].sort((a, b) =>
      a.email.localeCompare(b.email),
    );
  }, [adminRoleUsers, superRoleUsers]);

  const isLoading = loadingAdmins || loadingSupers;

  const saveMut = useMutation({
    mutationFn: ({
      userId,
      capabilities,
    }: {
      userId: string;
      capabilities: AdminDomainCapability[];
      email: string;
    }) => adminApi.setUserAdminCapabilities(userId, capabilities),
    onSuccess: (data, vars) => {
      setLocalCaps((prev) => ({
        ...prev,
        [vars.userId]: normalizeCaps(data.capabilities),
      }));
      setErrorMsg(null);
      setStatusMsg(`Updated write access for ${vars.email}.`);
      void queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      void queryClient.invalidateQueries({
        queryKey: ['admin', 'users', 'domain-access'],
      });
      window.setTimeout(() => setStatusMsg(null), 4000);
    },
    onError: (err) => {
      setStatusMsg(null);
      setErrorMsg(
        getApiErrorMessage(err, 'Could not update domain write access.'),
      );
    },
  });

  function capsFor(user: AdminUser): AdminCapability[] {
    if (localCaps[user.id]) return localCaps[user.id];
    return normalizeCaps(user.adminCapabilities);
  }

  function toggle(user: AdminUser, cap: AdminCapability) {
    const current = capsFor(user);
    const next = current.includes(cap)
      ? current.filter((c) => c !== cap)
      : [...current, cap];
    setLocalCaps((prev) => ({ ...prev, [user.id]: next }));
    saveMut.mutate({
      userId: user.id,
      capabilities: next,
      email: user.email,
    });
  }

  return (
    <div className="bg-card rounded-card border border-border p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-rose-700" aria-hidden />
          <h2 className="text-lg font-semibold text-foreground">
            Admin write access
          </h2>
          <span className="rounded-full bg-rose-100 px-2.5 py-0.5 text-xs font-semibold text-rose-800">
            Super Admin
          </span>
        </div>
        <p className="text-xs text-muted-foreground max-w-xl text-right">
          All admins can read. Toggle domains to grant Create / Update / Delete
          (Cognito groups). Super Admins always have full write.
        </p>
      </div>

      {errorMsg ? (
        <p className="mb-3 rounded-lg border border-destructive/25 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {errorMsg}
        </p>
      ) : null}
      {statusMsg ? (
        <p className="mb-3 rounded-lg border border-success/25 bg-success/10 px-3 py-2 text-sm text-success">
          {statusMsg}
        </p>
      ) : null}

      {isLoading ? (
        <div className="py-8 text-center text-muted-foreground">
          Loading admins…
        </div>
      ) : adminUsers.length === 0 ? (
        <div className="py-8 text-center text-muted-foreground">
          No ADMIN or SUPER_ADMIN users yet.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-border">
            <thead>
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                  User
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                  Role
                </th>
                {ADMIN_CAPABILITIES.map((cap) => (
                  <th
                    key={cap}
                    className="px-3 py-3 text-center text-xs font-medium text-muted-foreground uppercase"
                    title={CAPABILITY_TO_COGNITO_GROUP[cap]}
                  >
                    {DOMAIN_LABELS[cap]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {adminUsers.map((user) => {
                const name =
                  [user.firstName, user.lastName].filter(Boolean).join(' ') ||
                  user.email;
                const caps = capsFor(user);
                const isSuper = user.role === 'SUPER_ADMIN';
                const saving =
                  saveMut.isPending && saveMut.variables?.userId === user.id;
                return (
                  <tr key={user.id} className="hover:bg-muted/40">
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium text-foreground">
                        {name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {user.email}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {isSuper ? 'Super Admin' : 'Admin'}
                      {saving ? (
                        <Loader2
                          className="ml-2 inline h-3.5 w-3.5 animate-spin text-muted-foreground"
                          aria-hidden
                        />
                      ) : null}
                    </td>
                    {ADMIN_CAPABILITIES.map((cap) => {
                      const checked = isSuper || caps.includes(cap);
                      return (
                        <td key={cap} className="px-3 py-3 text-center">
                          <input
                            type="checkbox"
                            className="h-4 w-4 rounded border-border text-gray-900 focus:ring-gray-900 disabled:opacity-50"
                            checked={checked}
                            disabled={isSuper || saving}
                            title={
                              isSuper
                                ? 'Super Admins always have full write access'
                                : CAPABILITY_TO_COGNITO_GROUP[cap]
                            }
                            aria-label={`${DOMAIN_LABELS[cap]} write for ${user.email}`}
                            onChange={() => toggle(user, cap)}
                          />
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
