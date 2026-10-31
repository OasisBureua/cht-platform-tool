import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { Check, Loader2, Send, X } from 'lucide-react';
import { adminApi, type AdminCapabilityAccessRequest } from '../../api/admin';
import { getApiErrorMessage } from '../../api/client';
import { useAuth } from '../../contexts/AuthContext';
import {
  ADMIN_CAPABILITIES,
  type AdminCapability,
} from '../../utils/admin-capabilities';
import { isSuperAdmin } from '../../utils/roles';

const DOMAIN_LABELS: Record<AdminCapability, string> = {
  payments: 'Payments',
  programs: 'Programs',
  surveys: 'Surveys',
  reports: 'Reports',
  content: 'Content',
};

function statusClass(status: string): string {
  if (status === 'PENDING') return 'bg-warning/10 text-warning';
  if (status === 'APPROVED') return 'bg-success/10 text-success';
  if (status === 'DENIED') return 'bg-destructive/10 text-destructive';
  return 'bg-muted text-muted-foreground';
}

/** ADMIN: request missing domain write access. SUPER_ADMIN: review queue. */
export function AdminCapabilityRequestPanel() {
  const { user } = useAuth();
  const actorIsSuper = isSuperAdmin(user?.role);
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<AdminCapability[]>([]);
  const [note, setNote] = useState('');
  const [message, setMessage] = useState<{ ok?: string; err?: string }>({});

  const owned = useMemo(() => {
    if (actorIsSuper) return new Set<AdminCapability>([...ADMIN_CAPABILITIES]);
    return new Set(
      (user?.capabilities ?? []).filter((c): c is AdminCapability =>
        (ADMIN_CAPABILITIES as readonly string[]).includes(c),
      ),
    );
  }, [actorIsSuper, user?.capabilities]);

  const requestable = ADMIN_CAPABILITIES.filter((c) => !owned.has(c));

  const { data: requests = [], isLoading } = useQuery({
    queryKey: ['admin', 'capability-access-requests', actorIsSuper ? 'all' : 'mine'],
    queryFn: () =>
      adminApi.listCapabilityAccessRequests(
        actorIsSuper ? { status: 'PENDING' } : undefined,
      ),
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({
      queryKey: ['admin', 'capability-access-requests'],
    });
    void queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
    void queryClient.invalidateQueries({
      queryKey: ['admin', 'users', 'domain-access'],
    });
  };

  const createMut = useMutation({
    mutationFn: () =>
      adminApi.createCapabilityAccessRequest({
        capabilities: selected,
        note: note.trim() || undefined,
      }),
    onSuccess: () => {
      setSelected([]);
      setNote('');
      setMessage({ ok: 'Request sent to Super Admins.' });
      invalidate();
    },
    onError: (err) => {
      setMessage({
        err: getApiErrorMessage(err, 'Could not submit request.'),
      });
    },
  });

  const reviewMut = useMutation({
    mutationFn: ({
      id,
      decision,
    }: {
      id: string;
      decision: 'approve' | 'deny';
    }) =>
      decision === 'approve'
        ? adminApi.approveCapabilityAccessRequest(id)
        : adminApi.denyCapabilityAccessRequest(id),
    onSuccess: (_data, vars) => {
      setMessage({
        ok: vars.decision === 'approve' ? 'Request approved.' : 'Request denied.',
      });
      invalidate();
    },
    onError: (err) => {
      setMessage({
        err: getApiErrorMessage(err, 'Could not update request.'),
      });
    },
  });

  const cancelMut = useMutation({
    mutationFn: (id: string) => adminApi.cancelCapabilityAccessRequest(id),
    onSuccess: () => {
      setMessage({ ok: 'Request cancelled.' });
      invalidate();
    },
    onError: (err) => {
      setMessage({
        err: getApiErrorMessage(err, 'Could not cancel request.'),
      });
    },
  });

  const toggle = (cap: AdminCapability) => {
    setSelected((prev) =>
      prev.includes(cap) ? prev.filter((c) => c !== cap) : [...prev, cap],
    );
    setMessage({});
  };

  const pendingMine = requests.filter(
    (r) => r.status === 'PENDING' && r.requesterId === user?.userId,
  );

  return (
    <div className="rounded-card border border-border bg-card p-5 space-y-4">
      <div>
        <h2 className="text-base font-semibold text-foreground">
          {actorIsSuper ? 'Write access requests' : 'Request write access'}
        </h2>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {actorIsSuper
            ? 'Approve or deny pending domain write requests from Admins.'
            : 'Ask a Super Admin for Create / Update / Delete on specific domains. You keep read access meanwhile.'}
        </p>
      </div>

      {message.ok ? (
        <p className="rounded-lg border border-success/25 bg-success/10 px-3 py-2 text-sm text-success">
          {message.ok}
        </p>
      ) : null}
      {message.err ? (
        <p className="rounded-lg border border-destructive/25 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {message.err}
        </p>
      ) : null}

      {!actorIsSuper ? (
        <div className="space-y-3 rounded-xl border border-border bg-muted/30 p-4">
          {requestable.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              You already have write access for every domain.
            </p>
          ) : (
            <>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Domains to request
              </p>
              <div className="flex flex-wrap gap-2">
                {requestable.map((cap) => {
                  const on = selected.includes(cap);
                  return (
                    <button
                      key={cap}
                      type="button"
                      onClick={() => toggle(cap)}
                      className={[
                        'rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors',
                        on
                          ? 'border-brand-600 bg-brand-50 text-brand-900'
                          : 'border-border bg-card text-foreground hover:bg-muted',
                      ].join(' ')}
                    >
                      {DOMAIN_LABELS[cap]}
                    </button>
                  );
                })}
              </div>
              <label className="block text-xs font-semibold text-muted-foreground">
                Note (optional)
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={2}
                  maxLength={500}
                  placeholder="Why you need these domains…"
                  className="mt-1 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground"
                />
              </label>
              <button
                type="button"
                disabled={selected.length === 0 || createMut.isPending}
                onClick={() => createMut.mutate()}
                className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-40"
              >
                {createMut.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                Send request
              </button>
              {pendingMine.length > 0 ? (
                <p className="text-xs text-muted-foreground">
                  Submitting again replaces your current pending request.
                </p>
              ) : null}
            </>
          )}
        </div>
      ) : null}

      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {actorIsSuper ? 'Pending' : 'Your requests'}
        </p>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : requests.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {actorIsSuper ? 'No pending requests.' : 'No requests yet.'}
          </p>
        ) : (
          <ul className="divide-y divide-border rounded-xl border border-border">
            {requests.map((r) => (
              <RequestRow
                key={r.id}
                request={r}
                actorIsSuper={actorIsSuper}
                isSelf={r.requesterId === user?.userId}
                busy={reviewMut.isPending || cancelMut.isPending}
                onApprove={() =>
                  reviewMut.mutate({ id: r.id, decision: 'approve' })
                }
                onDeny={() => reviewMut.mutate({ id: r.id, decision: 'deny' })}
                onCancel={() => cancelMut.mutate(r.id)}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function RequestRow({
  request,
  actorIsSuper,
  isSelf,
  busy,
  onApprove,
  onDeny,
  onCancel,
}: {
  request: AdminCapabilityAccessRequest;
  actorIsSuper: boolean;
  isSelf: boolean;
  busy: boolean;
  onApprove: () => void;
  onDeny: () => void;
  onCancel: () => void;
}) {
  const name =
    [request.requester.firstName, request.requester.lastName]
      .filter(Boolean)
      .join(' ') || request.requester.email;
  const caps = request.capabilities
    .map((c) => DOMAIN_LABELS[c as AdminCapability] ?? c)
    .join(', ');

  return (
    <li className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-foreground">{name}</span>
          <span
            className={[
              'rounded-full px-2 py-0.5 text-[11px] font-semibold',
              statusClass(request.status),
            ].join(' ')}
          >
            {request.status}
          </span>
        </div>
        <p className="text-xs text-muted-foreground">{request.requester.email}</p>
        <p className="mt-1 text-sm text-foreground">{caps}</p>
        {request.note ? (
          <p className="mt-0.5 text-xs text-muted-foreground italic">
            “{request.note}”
          </p>
        ) : null}
        <p className="mt-1 text-[11px] text-muted-foreground">
          {format(parseISO(request.createdAt), 'MMM d, yyyy h:mm a')}
        </p>
      </div>
      <div className="flex flex-wrap gap-2 shrink-0">
        {actorIsSuper && request.status === 'PENDING' ? (
          <>
            <button
              type="button"
              disabled={busy}
              onClick={onApprove}
              className="inline-flex items-center gap-1 rounded-lg bg-green-700 px-2.5 py-1.5 text-xs font-semibold text-white disabled:opacity-40"
            >
              <Check className="h-3.5 w-3.5" />
              Approve
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={onDeny}
              className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold text-foreground disabled:opacity-40"
            >
              <X className="h-3.5 w-3.5" />
              Deny
            </button>
          </>
        ) : null}
        {!actorIsSuper && isSelf && request.status === 'PENDING' ? (
          <button
            type="button"
            disabled={busy}
            onClick={onCancel}
            className="rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold text-foreground disabled:opacity-40"
          >
            Cancel
          </button>
        ) : null}
      </div>
    </li>
  );
}
