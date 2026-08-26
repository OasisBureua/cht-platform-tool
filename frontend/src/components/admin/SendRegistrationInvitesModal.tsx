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
        <p className="text-xs font-semibold text-muted-foreground">{label}</p>
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
        <p className="rounded-[6px] border border-dashed border-border px-3 py-2 text-xs text-muted-foreground">
          {emptyMessage}
        </p>
      ) : (
        <div className="max-h-36 overflow-y-auto rounded-[6px] border border-border divide-y divide-gray-100">
          {options.map((option) => (
            <label
              key={option}
              className="flex cursor-pointer items-start gap-2 px-3 py-2 text-sm hover:bg-muted"
            >
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 rounded border-border"
                checked={selected.has(option)}
                onChange={() => toggle(option)}
              />
              <span className="min-w-0 text-foreground">
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
  const [recipientMode, setRecipientMode] = useState<'role' | 'users' | 'emails'>('role');
  const [role, setRole] = useState<'HCP' | 'KOL'>('HCP');
  const [selectedCities, setSelectedCities] = useState<Set<string>>(new Set());
  const [selectedStates, setSelectedStates] = useState<Set<string>>(new Set());
  const [selectedInstitutions, setSelectedInstitutions] = useState<Set<string>>(new Set());
  const [userSearch, setUserSearch] = useState('');
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());
  const [emailsInput, setEmailsInput] = useState('');
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

  const parsedEmails = useMemo(
    () =>
      Array.from(
        new Set(
          emailsInput
            .split(/[,\s;]+/)
            .map((e) => e.trim().toLowerCase())
            .filter((e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)),
        ),
      ),
    [emailsInput],
  );
  const rawEmailTokens = emailsInput.split(/[,\s;]+/).filter(Boolean);
  const invalidEmailCount = rawEmailTokens.length - parsedEmails.length;

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
          : recipientMode === 'users'
            ? { userIds: [...selectedUserIds] }
            : { emails: parsedEmails }),
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
      : recipientMode === 'users'
        ? selectedUserIds.size > 0
        : parsedEmails.length > 0) &&
    !sendMut.isPending;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-card bg-card shadow-xl">
        <div className="sticky top-0 z-10 flex items-start justify-between border-b border-border bg-card px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Send registration invites</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Share the multi-webinar registration page or email learners a link with sessions pre-selected.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-[6px] p-1 text-muted-foreground hover:bg-muted hover:text-muted-foreground"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-6">
          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-foreground">1. Select webinars</h3>
            {upcoming.length === 0 ? (
              <p className="text-sm text-muted-foreground">No published upcoming webinars.</p>
            ) : (
              <ul className="max-h-48 overflow-y-auto divide-y divide-gray-100 rounded-card border border-border">
                {upcoming.map((w) => (
                  <li key={w.id}>
                    <label className="flex cursor-pointer items-start gap-3 px-4 py-3 hover:bg-muted">
                      <input
                        type="checkbox"
                        className="mt-1 h-4 w-4 rounded border-border"
                        checked={selectedProgramIds.has(w.id)}
                        onChange={() => toggleProgram(w.id)}
                      />
                      <span className="min-w-0 flex-1 text-sm">
                        <span className="font-medium text-foreground">{w.title}</span>
                        {w.startDate ? (
                          <span className="mt-0.5 block text-muted-foreground">
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
            <h3 className="text-sm font-semibold text-foreground">2. Registration landing page</h3>
            <div className="rounded-card border border-border bg-muted px-4 py-3 text-sm">
              <p className="text-muted-foreground mb-2">
                Learners open this link to register for the selected sessions (
                <code className="text-xs bg-card px-1 rounded">/app/live/register-multiple</code>
                ).
              </p>
              <code className="block break-all text-xs text-foreground">{registerUrl}</code>
              <button
                type="button"
                disabled={selectedProgramIds.size === 0}
                onClick={() => void copyLink()}
                className="mt-3 inline-flex items-center gap-2 rounded-[6px] border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-muted disabled:opacity-40"
              >
                <Copy className="h-3.5 w-3.5" />
                {copied ? 'Copied' : 'Copy link'}
              </button>
            </div>
          </section>

          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-foreground">3. Email recipients</h3>
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
              <label className="inline-flex items-center gap-2">
                <input
                  type="radio"
                  name="recipientMode"
                  checked={recipientMode === 'emails'}
                  onChange={() => setRecipientMode('emails')}
                />
                Email addresses (unregistered ok)
              </label>
            </div>

            {recipientMode === 'role' ? (
              <div className="space-y-4">
                <select
                  value={role}
                  onChange={(e) => handleRoleChange(e.target.value as 'HCP' | 'KOL')}
                  className="rounded-[6px] border border-border px-3 py-2 text-sm"
                >
                  <option value="HCP">All active HCPs</option>
                  <option value="KOL">All active KOLs</option>
                </select>

                <div className="rounded-card border border-border bg-muted p-4 space-y-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-foreground">Target by location and organization</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        Select one or more values in each filter. Multiple filters combine with AND logic.
                      </p>
                    </div>
                    {hasLocationFilters ? (
                      <button
                        type="button"
                        onClick={clearLocationFilters}
                        className="rounded-[6px] border border-border bg-card px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-muted"
                      >
                        Clear all filters
                      </button>
                    ) : null}
                  </div>

                  {filterOptionsLoading ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
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
                    <p className="text-sm font-semibold text-foreground">Matching recipients</p>
                    {roleRecipientsLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    ) : (
                      <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">
                        {roleRecipientTotal}
                      </span>
                    )}
                  </div>

                  {roleRecipientTotal === 0 && !roleRecipientsLoading ? (
                    <p className="text-sm text-amber-800 rounded-[6px] bg-amber-50 border border-amber-200 px-3 py-2">
                      No active users match the selected role and filters.
                    </p>
                  ) : null}

                  {roleRecipientPreview.length > 0 ? (
                    <ul className="max-h-48 overflow-y-auto rounded-card border border-border divide-y divide-gray-100">
                      {roleRecipientPreview.map((u) => (
                        <li key={u.id} className="px-3 py-2 text-sm">
                          <p className="font-medium text-foreground">
                            {u.firstName} {u.lastName}
                            <span className="font-normal text-muted-foreground"> · {u.email}</span>
                          </p>
                          <p className="mt-0.5 text-xs text-muted-foreground">{formatLocationBits(u)}</p>
                        </li>
                      ))}
                    </ul>
                  ) : null}

                  {roleRecipientTotal > roleRecipientPreview.length ? (
                    <p className="text-xs text-muted-foreground">
                      Showing first {roleRecipientPreview.length} of {roleRecipientTotal} matching recipients.
                    </p>
                  ) : roleRecipientTotal > 0 ? (
                    <p className="text-xs text-muted-foreground">
                      {hasLocationFilters
                        ? 'Filtered active users shown above.'
                        : 'All active users in this role are included.'}
                    </p>
                  ) : null}
                </div>
              </div>
            ) : recipientMode === 'emails' ? (
              <div className="space-y-2">
                <textarea
                  value={emailsInput}
                  onChange={(e) => setEmailsInput(e.target.value)}
                  rows={4}
                  placeholder="alice@example.com, bob@example.com&#10;carol@example.com"
                  className="w-full rounded-[6px] border border-border px-3 py-2 text-sm font-mono"
                />
                <p className="text-xs text-muted-foreground">
                  Separate with commas, spaces, semicolons, or newlines. Recipients not yet registered will be directed to sign up when they open the link.
                </p>
                {parsedEmails.length > 0 || invalidEmailCount > 0 ? (
                  <p className="text-xs text-muted-foreground">
                    {parsedEmails.length} valid
                    {invalidEmailCount > 0 ? ` · ${invalidEmailCount} invalid (skipped)` : ''}
                  </p>
                ) : null}
              </div>
            ) : (
              <div className="space-y-2">
                <input
                  type="search"
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  placeholder="Search by name or email (min. 2 characters)…"
                  className="w-full rounded-[6px] border border-border px-3 py-2 text-sm"
                />
                {usersLoading ? (
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                ) : null}
                {searchUsers.length > 0 ? (
                  <ul className="max-h-40 overflow-y-auto rounded-card border border-border divide-y divide-gray-100">
                    {searchUsers.map((u) => (
                      <li key={u.id}>
                        <label className="flex cursor-pointer items-center gap-3 px-3 py-2 hover:bg-muted text-sm">
                          <input
                            type="checkbox"
                            checked={selectedUserIds.has(u.id)}
                            onChange={() => toggleUser(u.id)}
                          />
                          <span>
                            {u.firstName} {u.lastName}
                            <span className="text-muted-foreground"> · {u.email}</span>
                          </span>
                        </label>
                      </li>
                    ))}
                  </ul>
                ) : userSearch.trim().length >= 2 ? (
                  <p className="text-xs text-muted-foreground">No users found.</p>
                ) : null}
                {selectedUserIds.size > 0 ? (
                  <p className="text-xs text-muted-foreground">{selectedUserIds.size} user(s) selected</p>
                ) : null}
              </div>
            )}
          </section>

          {result ? (
            <div className="rounded-card border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-950 space-y-1">
              <p className="font-semibold">Sent {result.emailed} email(s)</p>
              {result.skipped.length > 0 ? (
                <p className="text-xs">{result.skipped.length} skipped (see server logs)</p>
              ) : null}
            </div>
          ) : null}

          {sendMut.isError ? (
            <p className="text-sm text-destructive">{getApiErrorMessage(sendMut.error)}</p>
          ) : null}
        </div>

        <div className="sticky bottom-0 flex justify-end gap-3 border-t border-border bg-card px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-[6px] border border-border px-4 py-2 text-sm font-semibold text-muted-foreground hover:bg-muted"
          >
            Close
          </button>
          <button
            type="button"
            disabled={!canSend}
            onClick={() => sendMut.mutate()}
            className="inline-flex items-center gap-2 rounded-[6px] bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-40"
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
