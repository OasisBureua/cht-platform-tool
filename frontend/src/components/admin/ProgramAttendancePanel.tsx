import { useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { Check, Loader2, X } from 'lucide-react';
import {
  adminApi,
  type ProgramRegistrationAdminRow,
} from '../../api/admin';
import { getApiErrorMessage } from '../../api/client';
import { attendanceStatusLabel } from '../../utils/admin-survey-display';
import {
  adminCapabilityDeniedMessage,
  guardAdminAction,
  hasAdminCapability,
} from '../../utils/admin-capabilities';
import { useAuth } from '../../contexts/AuthContext';

function parseEmails(raw: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of raw.split(/[\s,;]+/)) {
    const email = part.trim().toLowerCase();
    if (!email || !email.includes('@') || seen.has(email)) continue;
    seen.add(email);
    out.push(email);
  }
  return out;
}

function attendanceBadgeClass(att: string | null | undefined): string {
  if (att === 'VERIFIED') return 'bg-green-100 text-success';
  if (att === 'DENIED') return 'bg-red-100 text-destructive';
  if (att === 'PENDING_VERIFICATION') return 'bg-warning/10 text-warning';
  return 'bg-muted text-muted-foreground';
}

function attendanceDisplay(att: string | null | undefined): string {
  if (att === 'VERIFIED') return 'Verified';
  if (att === 'DENIED') return 'Denied';
  return attendanceStatusLabel(att);
}

type Props = {
  programId: string;
  registrations: ProgramRegistrationAdminRow[];
  loading?: boolean;
};

export function ProgramAttendancePanel({
  programId,
  registrations,
  loading,
}: Props) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const canWrite = hasAdminCapability(user, 'programs');
  const deniedTitle = adminCapabilityDeniedMessage('programs');
  const [emailDraft, setEmailDraft] = useState('');
  const [message, setMessage] = useState<{ ok?: string; err?: string }>({});

  const approved = useMemo(
    () => registrations.filter((r) => r.status === 'APPROVED'),
    [registrations],
  );

  const byEmail = useMemo(() => {
    const map = new Map<string, ProgramRegistrationAdminRow>();
    for (const r of approved) {
      map.set(r.user.email.trim().toLowerCase(), r);
    }
    return map;
  }, [approved]);

  const invalidate = () => {
    void queryClient.invalidateQueries({
      queryKey: ['admin', 'program', programId, 'registrations'],
    });
  };

  const setAttendanceMut = useMutation({
    mutationFn: ({
      registrationId,
      status,
    }: {
      registrationId: string;
      status: 'VERIFIED' | 'DENIED';
    }) => adminApi.updatePostEventAttendance(registrationId, status),
    onSuccess: () => invalidate(),
  });

  const runForEmails = async (status: 'VERIFIED' | 'DENIED') => {
    const emails = parseEmails(emailDraft);
    if (emails.length === 0) {
      setMessage({ err: 'Enter at least one email address.' });
      return;
    }
    const missing: string[] = [];
    const targets: ProgramRegistrationAdminRow[] = [];
    for (const email of emails) {
      const row = byEmail.get(email);
      if (!row) missing.push(email);
      else targets.push(row);
    }
    if (missing.length) {
      setMessage({
        err: `Not an approved registrant on this program: ${missing.join(', ')}`,
      });
      return;
    }

    const results: string[] = [];
    for (const row of targets) {
      try {
        await setAttendanceMut.mutateAsync({
          registrationId: row.id,
          status,
        });
        results.push(`${row.user.email} → ${status}`);
      } catch (err) {
        results.push(
          `${row.user.email}: ${getApiErrorMessage(err, 'failed')}`,
        );
      }
    }
    setMessage({
      ok: `Updated ${targets.length}: ${results.join('; ')}. Verifying emails the post-event survey when applicable.`,
    });
    setEmailDraft('');
  };

  const busy = setAttendanceMut.isPending;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Attendance</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Override attendance for approved learners on this program. Verified unlocks
          the post-event survey (and sends the survey email). Denied marks them as
          missed.
        </p>
      </div>

      <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-3">
        <p className="text-sm font-semibold text-foreground">Override by email</p>
        <p className="text-xs text-muted-foreground">
          Paste one or more emails (comma, space, or newline separated). Must already
          be approved on this program.
        </p>
        <textarea
          value={emailDraft}
          onChange={(e) => {
            setEmailDraft(e.target.value);
            setMessage({});
          }}
          rows={3}
          placeholder="learner@example.com"
          className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground"
        />
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={!canWrite || busy || !emailDraft.trim()}
            title={!canWrite ? deniedTitle : undefined}
            onClick={() =>
              guardAdminAction(user, 'programs', () => {
                void runForEmails('VERIFIED');
              })
            }
            className="inline-flex items-center gap-1.5 rounded-lg bg-green-700 px-3 py-2 text-xs font-semibold text-white hover:bg-green-800 disabled:opacity-40"
          >
            {busy ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Check className="h-3.5 w-3.5" />
            )}
            Verify attendance
          </button>
          <button
            type="button"
            disabled={!canWrite || busy || !emailDraft.trim()}
            title={!canWrite ? deniedTitle : undefined}
            onClick={() =>
              guardAdminAction(user, 'programs', () => {
                void runForEmails('DENIED');
              })
            }
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground hover:bg-muted disabled:opacity-40"
          >
            <X className="h-3.5 w-3.5" />
            Mark missed
          </button>
        </div>
        {message.ok ? (
          <p className="text-xs text-success" role="status">
            {message.ok}
          </p>
        ) : null}
        {message.err ? (
          <p className="text-xs text-destructive" role="alert">
            {message.err}
          </p>
        ) : null}
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading registrations…</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-3 font-semibold">Learner</th>
                <th className="px-4 py-3 font-semibold">Zoom</th>
                <th className="px-4 py-3 font-semibold">Attendance</th>
                <th className="px-4 py-3 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {approved.map((r) => {
                const att = r.postEventAttendanceStatus;
                const canOverride =
                  att === 'PENDING_VERIFICATION' ||
                  att === 'DENIED' ||
                  att === 'VERIFIED';
                return (
                  <tr key={r.id} className="hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <div className="font-medium text-foreground">
                        {r.user.firstName} {r.user.lastName}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {r.user.email}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {r.zoomJoined ? (
                        <div>
                          <span className="inline-block rounded-full bg-sky-100 px-2 py-0.5 text-[11px] font-semibold text-sky-800">
                            Joined
                          </span>
                          {r.zoomParticipantEmail &&
                          r.zoomParticipantEmail.trim().toLowerCase() !==
                            r.user.email.trim().toLowerCase() ? (
                            <div className="mt-0.5 text-[11px] text-muted-foreground">
                              Zoom: {r.zoomParticipantEmail}
                            </div>
                          ) : null}
                        </div>
                      ) : (
                        <span className="inline-block rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
                          Not seen
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={[
                          'inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold',
                          attendanceBadgeClass(att),
                        ].join(' ')}
                      >
                        {attendanceDisplay(att)}
                      </span>
                      {r.postEventAttendanceReviewedAt ? (
                        <div className="mt-0.5 text-[11px] text-muted-foreground">
                          {format(
                            parseISO(r.postEventAttendanceReviewedAt),
                            'MMM d, h:mm a',
                          )}
                        </div>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {canOverride ? (
                        <div className="inline-flex flex-wrap justify-end gap-1.5">
                          <button
                            type="button"
                            disabled={
                              !canWrite || busy || att === 'VERIFIED'
                            }
                            title={
                              !canWrite
                                ? deniedTitle
                                : att === 'VERIFIED'
                                  ? 'Already verified'
                                  : 'Mark attendance verified'
                            }
                            onClick={() =>
                              guardAdminAction(user, 'programs', () => {
                                setAttendanceMut.mutate({
                                  registrationId: r.id,
                                  status: 'VERIFIED',
                                });
                              })
                            }
                            className="rounded-lg bg-green-700 px-2 py-1 text-[11px] font-semibold text-white disabled:opacity-40"
                          >
                            Verify
                          </button>
                          <button
                            type="button"
                            disabled={!canWrite || busy || att === 'DENIED'}
                            title={
                              !canWrite
                                ? deniedTitle
                                : att === 'DENIED'
                                  ? 'Already denied'
                                  : 'Mark as missed'
                            }
                            onClick={() =>
                              guardAdminAction(user, 'programs', () => {
                                setAttendanceMut.mutate({
                                  registrationId: r.id,
                                  status: 'DENIED',
                                });
                              })
                            }
                            className="rounded-lg border border-border px-2 py-1 text-[11px] font-semibold disabled:opacity-40"
                          >
                            Missed
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {approved.length === 0 ? (
            <p className="px-4 py-6 text-sm text-muted-foreground">
              No approved registrations yet. Approve learners first, then override
              attendance here.
            </p>
          ) : null}
        </div>
      )}
    </div>
  );
}
