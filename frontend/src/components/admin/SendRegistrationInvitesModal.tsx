import { useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { Copy, Loader2, Mail, X } from 'lucide-react';
import { adminApi, type AdminWebinar } from '../../api/admin';
import { buildMultiRegisterHref } from '../../utils/intake-return';
import { getApiErrorMessage } from '../../api/client';
import { usStateLabel } from '../../data/us-states';

type Props = {
  webinars: AdminWebinar[];
  open: boolean;
  onClose: () => void;
};

type MultiSelectFilterProps = {
  label: string;
  options: string[];
  selected: Set<string>;
  onChange: (next: Set<string>) => void;
  formatOption?: (value: string) => string;
  emptyMessage?: string;
};

function MultiSelectFilter({
  label,
  options,
  selected,
  onChange,
  formatOption,
  emptyMessage = 'No values on file',
}: MultiSelectFilterProps) {
  const toggle = (value: string) => {
    const next = new Set(selected);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    onChange(next);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold text-gray-700">{label}</p>
        {selected.size > 0 ? (
          <button
            type="button"
            onClick={() => onChange(new Set())}
            className="text-xs font-medium text-brand-700 hover:text-brand-800"
          >
            Clear
          </button>
        ) : null}
      </div>
      {options.length === 0 ? (
        <p className="rounded-lg border border-dashed border-gray-200 px-3 py-2 text-xs text-gray-500">
          {emptyMessage}
        </p>
      ) : (
        <div className="max-h-36 overflow-y-auto rounded-lg border border-gray-200 divide-y divide-gray-100">
          {options.map((option) => (
            <label
              key={option}
              className="flex cursor-pointer items-start gap-2 px-3 py-2 text-sm hover:bg-gray-50"
            >
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 rounded border-gray-300"
                checked={selected.has(option)}
                onChange={() => toggle(option)}
              />
              <span className="min-w-0 text-gray-800">
                {formatOption ? formatOption(option) : option}
              </span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

function formatLocationBits(user: {
  city?: string | null;
  state?: string | null;
  institution?: string | null;
}) {
  const parts = [
    user.city?.trim(),
    user.state?.trim() ? usStateLabel(user.state) : null,
    user.institution?.trim(),
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(' · ') : 'Location not on file';
}

export default function SendRegistrationInvitesModal({ webinars, open, onClose }: Props) {
  const [selectedProgramIds, setSelectedProgramIds] = useState<Set<string>>(new Set());
  const [recipientMode, setRecipientMode] = useState<'role' | 'users'>('role');
  const [role, setRole] = useState<'HCP' | 'KOL'>('HCP');
  const [selectedCities, setSelectedCities] = useState<Set<string>>(new Set());
  const [selectedStates, setSelectedStates] = useState<Set<string>>(new Set());
  const [selectedInstitutions, setSelectedInstitutions] = useState<Set<string>>(new Set());
  const [userSearch, setUserSearch] = useState('');
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());
  const [copied, setCopied] = useState(false);
  const [result, setResult] = useState<Awaited<
    ReturnType<typeof adminApi.sendRegistrationInvites>
  > | null>(null);

  const cityFilters = useMemo(() => [...selectedCities], [selectedCities]);
  const stateFilters = useMemo(() => [...selectedStates], [selectedStates]);
  const institutionFilters = useMemo(() => [...selectedInstitutions], [selectedInstitutions]);
  const hasLocationFilters =
    cityFilters.length > 0 || stateFilters.length > 0 || institutionFilters.length > 0;

  const upcoming = useMemo(
    () =>
      webinars
        .filter((w) => w.status === 'PUBLISHED')
        .filter((w) => !w.startDate || new Date(w.startDate).getTime() > Date.now() - 60 * 60 * 1000)
        .sort((a, b) => {
          const ta = a.startDate ? new Date(a.startDate).getTime() : 0;
          const tb = b.startDate ? new Date(b.startDate).getTime() : 0;
          return ta - tb;
        }),
    [webinars],
  );

  const { data: filterOptions, isLoading: filterOptionsLoading } = useQuery({
    queryKey: ['admin', 'registration-invite-filter-options', role],
    queryFn: () => adminApi.getRegistrationInviteFilterOptions(role),
    enabled: open && recipientMode === 'role',
    staleTime: 60_000,
  });

  const { data: roleRecipients, isFetching: roleRecipientsLoading } = useQuery({
    queryKey: [
      'admin',
      'registration-invite-recipients',
      role,
      cityFilters,
      stateFilters,
      institutionFilters,
    ],
    queryFn: () =>
      adminApi.getRegistrationInviteRecipients({
        role,
        cities: cityFilters,
        states: stateFilters,
        institutions: institutionFilters,
      }),
    enabled: open && recipientMode === 'role',
    staleTime: 10_000,
  });

  const { data: searchUsers = [], isFetching: usersLoading } = useQuery({
    queryKey: ['admin', 'users', 'invite-search', userSearch],
    queryFn: () =>
      adminApi.getUsers({
        q: userSearch.trim() || undefined,
        role: recipientMode === 'role' ? role : undefined,
        limit: 50,
      }),
    enabled: open && recipientMode === 'users' && userSearch.trim().length >= 2,
  });

  const registerPath = useMemo(
    () =>
      selectedProgramIds.size > 0
        ? buildMultiRegisterHref({ programIds: [...selectedProgramIds] })
        : buildMultiRegisterHref(),
    [selectedProgramIds],
  );

  const registerUrl =
    typeof window !== 'undefined' ? `${window.location.origin}${registerPath}` : registerPath;

  const sendMut = useMutation({
    mutationFn: () =>
      adminApi.sendRegistrationInvites({
        programIds: [...selectedProgramIds],
        ...(recipientMode === 'role'
          ? {
              role,
              ...(cityFilters.length ? { cities: cityFilters } : {}),
              ...(stateFilters.length ? { states: stateFilters } : {}),
              ...(institutionFilters.length ? { institutions: institutionFilters } : {}),
            }
          : { userIds: [...selectedUserIds] }),
      }),
    onSuccess: (data) => setResult(data),
  });

  if (!open) return null;

  const toggleProgram = (id: string) => {
    setSelectedProgramIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleUser = (id: string) => {
    setSelectedUserIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const clearLocationFilters = () => {
    setSelectedCities(new Set());
    setSelectedStates(new Set());
    setSelectedInstitutions(new Set());
  };

  const handleRoleChange = (nextRole: 'HCP' | 'KOL') => {
    setRole(nextRole);
    clearLocationFilters();
  };

  const copyLink = async () => {
    if (selectedProgramIds.size === 0) return;
    await navigator.clipboard.writeText(registerUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const roleRecipientTotal = roleRecipients?.total ?? 0;
  const roleRecipientPreview = roleRecipients?.recipients ?? [];

  const canSend =
    selectedProgramIds.size > 0 &&
    (recipientMode === 'role'
      ? roleRecipientTotal > 0 && !roleRecipientsLoading
      : selectedUserIds.size > 0) &&
    !sendMut.isPending;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-xl">
        <div className="sticky top-0 z-10 flex items-start justify-between border-b border-gray-200 bg-white px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Send registration invites</h2>
            <p className="mt-1 text-sm text-gray-600">
              Share the multi-webinar registration page or email learners a link with sessions pre-selected.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-6">
          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-gray-900">1. Select webinars</h3>
            {upcoming.length === 0 ? (
              <p className="text-sm text-gray-500">No published upcoming webinars.</p>
            ) : (
              <ul className="max-h-48 overflow-y-auto divide-y divide-gray-100 rounded-xl border border-gray-200">
                {upcoming.map((w) => (
                  <li key={w.id}>
                    <label className="flex cursor-pointer items-start gap-3 px-4 py-3 hover:bg-gray-50">
                      <input
                        type="checkbox"
                        className="mt-1 h-4 w-4 rounded border-gray-300"
                        checked={selectedProgramIds.has(w.id)}
                        onChange={() => toggleProgram(w.id)}
                      />
                      <span className="min-w-0 flex-1 text-sm">
                        <span className="font-medium text-gray-900">{w.title}</span>
                        {w.startDate ? (
                          <span className="mt-0.5 block text-gray-500">
                            {format(parseISO(w.startDate), 'MMM d, yyyy · h:mm a')}
                          </span>
                        ) : null}
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-gray-900">2. Registration landing page</h3>
            <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm">
              <p className="text-gray-600 mb-2">
                Learners open this link to register for the selected sessions (
                <code className="text-xs bg-white px-1 rounded">/app/live/register-multiple</code>
                ).
              </p>
              <code className="block break-all text-xs text-gray-800">{registerUrl}</code>
              <button
                type="button"
                disabled={selectedProgramIds.size === 0}
                onClick={() => void copyLink()}
                className="mt-3 inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-800 hover:bg-gray-50 disabled:opacity-40"
              >
                <Copy className="h-3.5 w-3.5" />
                {copied ? 'Copied' : 'Copy link'}
              </button>
            </div>
          </section>

          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-gray-900">3. Email recipients</h3>
            <div className="flex flex-wrap gap-4 text-sm">
              <label className="inline-flex items-center gap-2">
                <input
                  type="radio"
                  name="recipientMode"
                  checked={recipientMode === 'role'}
                  onChange={() => setRecipientMode('role')}
                />
                All active users by role
              </label>
              <label className="inline-flex items-center gap-2">
                <input
                  type="radio"
                  name="recipientMode"
                  checked={recipientMode === 'users'}
                  onChange={() => setRecipientMode('users')}
                />
                Choose specific users
              </label>
            </div>

            {recipientMode === 'role' ? (
              <div className="space-y-4">
                <select
                  value={role}
                  onChange={(e) => handleRoleChange(e.target.value as 'HCP' | 'KOL')}
                  className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
                >
                  <option value="HCP">All active HCPs</option>
                  <option value="KOL">All active KOLs</option>
                </select>

                <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 space-y-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-gray-900">Target by location and organization</p>
                      <p className="mt-0.5 text-xs text-gray-600">
                        Select one or more values in each filter. Multiple filters combine with AND logic.
                      </p>
                    </div>
                    {hasLocationFilters ? (
                      <button
                        type="button"
                        onClick={clearLocationFilters}
                        className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-100"
                      >
                        Clear all filters
                      </button>
                    ) : null}
                  </div>

                  {filterOptionsLoading ? (
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Loading filter options…
                    </div>
                  ) : (
                    <div className="grid gap-4 md:grid-cols-3">
                      <MultiSelectFilter
                        label="City"
                        options={filterOptions?.cities ?? []}
                        selected={selectedCities}
                        onChange={setSelectedCities}
                        emptyMessage="No cities on file for this role"
                      />
                      <MultiSelectFilter
                        label="State"
                        options={filterOptions?.states ?? []}
                        selected={selectedStates}
                        onChange={setSelectedStates}
                        formatOption={(value) => usStateLabel(value)}
                        emptyMessage="No states on file for this role"
                      />
                      <MultiSelectFilter
                        label="Organization"
                        options={filterOptions?.institutions ?? []}
                        selected={selectedInstitutions}
                        onChange={setSelectedInstitutions}
                        emptyMessage="No organizations on file for this role"
                      />
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-gray-900">Matching recipients</p>
                    {roleRecipientsLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                    ) : (
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-600">
                        {roleRecipientTotal}
                      </span>
                    )}
                  </div>

                  {roleRecipientTotal === 0 && !roleRecipientsLoading ? (
                    <p className="text-sm text-amber-800 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2">
                      No active users match the selected role and filters.
                    </p>
                  ) : null}

                  {roleRecipientPreview.length > 0 ? (
                    <ul className="max-h-48 overflow-y-auto rounded-xl border border-gray-200 divide-y divide-gray-100">
                      {roleRecipientPreview.map((u) => (
                        <li key={u.id} className="px-3 py-2 text-sm">
                          <p className="font-medium text-gray-900">
                            {u.firstName} {u.lastName}
                            <span className="font-normal text-gray-500"> · {u.email}</span>
                          </p>
                          <p className="mt-0.5 text-xs text-gray-500">{formatLocationBits(u)}</p>
                        </li>
                      ))}
                    </ul>
                  ) : null}

                  {roleRecipientTotal > roleRecipientPreview.length ? (
                    <p className="text-xs text-gray-500">
                      Showing first {roleRecipientPreview.length} of {roleRecipientTotal} matching recipients.
                    </p>
                  ) : roleRecipientTotal > 0 ? (
                    <p className="text-xs text-gray-500">
                      {hasLocationFilters
                        ? 'Filtered active users shown above.'
                        : 'All active users in this role are included.'}
                    </p>
                  ) : null}
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <input
                  type="search"
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  placeholder="Search by name or email (min. 2 characters)…"
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                />
                {usersLoading ? (
                  <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
                ) : null}
                {searchUsers.length > 0 ? (
                  <ul className="max-h-40 overflow-y-auto rounded-xl border border-gray-200 divide-y divide-gray-100">
                    {searchUsers.map((u) => (
                      <li key={u.id}>
                        <label className="flex cursor-pointer items-center gap-3 px-3 py-2 hover:bg-gray-50 text-sm">
                          <input
                            type="checkbox"
                            checked={selectedUserIds.has(u.id)}
                            onChange={() => toggleUser(u.id)}
                          />
                          <span>
                            {u.firstName} {u.lastName}
                            <span className="text-gray-500"> · {u.email}</span>
                          </span>
                        </label>
                      </li>
                    ))}
                  </ul>
                ) : userSearch.trim().length >= 2 ? (
                  <p className="text-xs text-gray-500">No users found.</p>
                ) : null}
                {selectedUserIds.size > 0 ? (
                  <p className="text-xs text-gray-600">{selectedUserIds.size} user(s) selected</p>
                ) : null}
              </div>
            )}
          </section>

          {result ? (
            <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-950 space-y-1">
              <p className="font-semibold">Sent {result.emailed} email(s)</p>
              {result.skipped.length > 0 ? (
                <p className="text-xs">{result.skipped.length} skipped (see server logs)</p>
              ) : null}
            </div>
          ) : null}

          {sendMut.isError ? (
            <p className="text-sm text-red-600">{getApiErrorMessage(sendMut.error)}</p>
          ) : null}
        </div>

        <div className="sticky bottom-0 flex justify-end gap-3 border-t border-gray-200 bg-white px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            Close
          </button>
          <button
            type="button"
            disabled={!canSend}
            onClick={() => sendMut.mutate()}
            className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-40"
          >
            {sendMut.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Mail className="h-4 w-4" />
            )}
            Send emails
          </button>
        </div>
      </div>
    </div>
  );
}
