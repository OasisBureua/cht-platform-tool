import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, Loader2, Mail, RefreshCw, Search } from 'lucide-react';
import { format } from 'date-fns';
import { adminApi, type ProgramInvitationRow } from '../../api/admin';
import { getApiErrorMessage } from '../../api/client';

const TYPE_LABEL: Record<string, string> = {
  REGISTRATION_INVITE: 'Registration invite',
  REGISTRATION_SUBMITTED: 'Registration submitted',
  REGISTRATION_APPROVED: 'Approval',
  REGISTRATION_REJECTED: 'Rejection',
  REGISTRATION_REVOKED: 'Revoked',
  PRE_SESSION_REMINDER: 'Reminder',
  POST_EVENT_SURVEY: 'Post-event survey',
  MISSED_SESSION: 'Missed session',
  OPERATIONAL: 'Operational',
  PUBLIC_REGISTRATION: 'Public registration',
  WEBINAR_ACCESS: 'Access link',
  REPORT_READY: 'Report ready',
  OTHER: 'Other',
};

const STATUS_LABEL: Record<string, string> = {
  SENT: 'Sent',
  DELIVERED: 'Delivered',
  BOUNCED: 'Bounced',
  FAILED: 'Failed',
  UNSUBSCRIBED: 'Unsubscribed',
};

const OUTCOME_LABEL: Record<string, string> = {
  NONE: 'None',
  REGISTERED: 'Registered',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  ATTENDED: 'Attended',
};

/**
 * Admin › Program Hub › Invitations: platform-sent emails for this event.
 */
export function ProgramInvitationsPanel({ programId }: { programId: string }) {
  const queryClient = useQueryClient();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [emailType, setEmailType] = useState('');
  const [resendRow, setResendRow] = useState<ProgramInvitationRow | null>(null);
  const [correctedEmail, setCorrectedEmail] = useState('');

  const queryKey = ['admin', 'program', programId, 'invitations', q, status, emailType];

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey,
    queryFn: () =>
      adminApi.listProgramInvitations(programId, {
        q: q.trim() || undefined,
        status: status || undefined,
        emailType: emailType || undefined,
      }),
    enabled: !!programId,
  });

  const resendMut = useMutation({
    mutationFn: () =>
      adminApi.resendProgramInvitation(programId, resendRow!.id, {
        correctedEmail: correctedEmail.trim() || undefined,
      }),
    onSuccess: () => {
      setResendRow(null);
      setCorrectedEmail('');
      void queryClient.invalidateQueries({ queryKey: ['admin', 'program', programId, 'invitations'] });
    },
  });

  const rows = data?.rows ?? [];
  const totals = data?.totals;

  type SortKey =
    | 'toName'
    | 'toEmail'
    | 'emailType'
    | 'sentAt'
    | 'sentBy'
    | 'status'
    | 'registrationOutcome';
  const [sortKey, setSortKey] = useState<SortKey>('sentAt');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortKey(key);
      setSortDir(key === 'sentAt' ? 'desc' : 'asc');
    }
  };

  const sorted = useMemo(() => {
    const copy = [...rows];
    const dir = sortDir === 'asc' ? 1 : -1;
    copy.sort((a, b) => {
      const av = a[sortKey] ?? '';
      const bv = b[sortKey] ?? '';
      if (typeof av === 'string' && typeof bv === 'string') {
        return av.localeCompare(bv) * dir;
      }
      return 0;
    });
    return copy;
  }, [rows, sortKey, sortDir]);

  const exportCsv = async () => {
    const blob = await adminApi.exportProgramInvitationsCsv(programId, {
      q: q.trim() || undefined,
      status: status || undefined,
      emailType: emailType || undefined,
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `program-${programId}-invitations.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Invitations</h2>
          <p className="text-sm text-muted-foreground">
            Platform-sent registration invites, approvals, and reminders for this event. External tools
            (personal email, HubSpot) are out of scope.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void refetch()}
            className="inline-flex h-9 items-center gap-2 rounded-[6px] border border-border bg-card px-3 text-sm font-medium text-foreground hover:bg-muted"
          >
            <RefreshCw className={['h-3.5 w-3.5', isFetching ? 'animate-spin' : ''].join(' ')} />
            Refresh
          </button>
          <button
            type="button"
            onClick={() => void exportCsv()}
            className="inline-flex h-9 items-center gap-2 rounded-[6px] border border-border bg-card px-3 text-sm font-medium text-foreground hover:bg-muted"
          >
            <Download className="h-3.5 w-3.5" />
            Export CSV
          </button>
        </div>
      </div>

      {totals ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          <Stat label="Invited" value={totals.invited} />
          <Stat label="Delivered" value={totals.delivered} />
          <Stat label="Bounced" value={totals.bounced} />
          <Stat label="Registered" value={totals.registered} />
          <Stat label="Attended" value={totals.attended} />
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <div className="relative min-w-[12rem] flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search name or email"
            className="h-9 w-full rounded-[6px] border border-border bg-card pl-8 pr-3 text-sm"
          />
        </div>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="h-9 rounded-[6px] border border-border bg-card px-2 text-sm"
        >
          <option value="">All statuses</option>
          {Object.entries(STATUS_LABEL).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <select
          value={emailType}
          onChange={(e) => setEmailType(e.target.value)}
          className="h-9 rounded-[6px] border border-border bg-card px-2 text-sm"
        >
          <option value="">All types</option>
          {Object.entries(TYPE_LABEL).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : isError ? (
        <p className="text-sm text-destructive">
          {getApiErrorMessage(error, 'Could not load invitations.')}
        </p>
      ) : sorted.length === 0 ? (
        <p className="rounded-[6px] border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
          No platform emails logged for this event yet. Send registration invites or operational email to
          populate this list.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-[6px] border border-border">
          <table className="min-w-full divide-y divide-border text-sm">
            <thead className="bg-muted">
              <tr>
                {(
                  [
                    ['toName', 'Name'],
                    ['toEmail', 'Email'],
                    ['emailType', 'Type'],
                    ['sentAt', 'Sent'],
                    ['sentBy', 'By'],
                    ['status', 'Delivery'],
                    ['registrationOutcome', 'Outcome'],
                  ] as const
                ).map(([key, label]) => (
                  <th key={key} className="px-3 py-2 text-left text-xs font-semibold uppercase text-muted-foreground">
                    <button
                      type="button"
                      onClick={() => toggleSort(key)}
                      className="inline-flex items-center gap-1 hover:text-foreground"
                    >
                      {label}
                      {sortKey === key ? (sortDir === 'asc' ? ' ↑' : ' ↓') : null}
                    </button>
                  </th>
                ))}
                <th className="px-3 py-2 text-right text-xs font-semibold uppercase text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border bg-card">
              {sorted.map((r) => (
                <tr key={r.id} className="hover:bg-muted/50">
                  <td className="px-3 py-2 font-medium text-foreground">{r.toName || '—'}</td>
                  <td className="px-3 py-2 text-muted-foreground">{r.toEmail}</td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {TYPE_LABEL[r.emailType] ?? r.emailType}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">
                    {format(new Date(r.sentAt), 'MMM d, yyyy · h:mm a')}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {r.sentBy === 'ADMIN' ? 'Admin' : 'Automatic'}
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={[
                        'inline-flex rounded-full px-2 py-0.5 text-xs font-semibold',
                        r.status === 'BOUNCED' || r.status === 'FAILED'
                          ? 'bg-destructive/10 text-destructive'
                          : r.status === 'DELIVERED'
                            ? 'bg-success/10 text-success'
                            : 'bg-muted text-muted-foreground',
                      ].join(' ')}
                    >
                      {STATUS_LABEL[r.status] ?? r.status}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {OUTCOME_LABEL[r.registrationOutcome] ?? r.registrationOutcome}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {r.canResend ? (
                      <button
                        type="button"
                        onClick={() => {
                          setResendRow(r);
                          setCorrectedEmail(r.toEmail);
                        }}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-foreground underline"
                      >
                        <Mail className="h-3.5 w-3.5" />
                        Re-send
                      </button>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {resendRow ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div
            role="dialog"
            aria-modal="true"
            className="w-full max-w-md space-y-4 rounded-card bg-card p-6 shadow-card-hover"
          >
            <h3 className="font-semibold text-foreground">Re-send invitation</h3>
            <p className="text-sm text-muted-foreground">
              Confirm re-send to this address. Correct the email if it bounced.
            </p>
            <label className="block text-sm">
              <span className="font-medium text-foreground">Email</span>
              <input
                value={correctedEmail}
                onChange={(e) => setCorrectedEmail(e.target.value)}
                className="mt-1 h-9 w-full rounded-[6px] border border-border bg-background px-3 text-sm"
              />
            </label>
            {resendMut.isError ? (
              <p className="text-sm text-destructive">
                {getApiErrorMessage(resendMut.error, 'Re-send failed.')}
              </p>
            ) : null}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setResendRow(null);
                  resendMut.reset();
                }}
                className="rounded-[6px] border border-border px-3 py-2 text-sm font-medium"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={resendMut.isPending || !correctedEmail.trim()}
                onClick={() => resendMut.mutate()}
                className="inline-flex items-center gap-2 rounded-[6px] bg-gray-900 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {resendMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Confirm re-send
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-[6px] border border-border bg-card px-3 py-2">
      <p className="text-[11px] font-semibold uppercase text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold text-foreground">{value}</p>
    </div>
  );
}
