import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { adminApi } from '../../api/admin';
import RejectRegistrationModal, { type RejectEmailReason } from '../../components/admin/RejectRegistrationModal';
import OperationalEmailModal from '../../components/admin/OperationalEmailModal';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import { HCP_PROFESSIONS } from '../../data/profession-options';
import { Mail } from 'lucide-react';
import {
  attendanceStatusLabel,
  registrationStatusClass,
  registrationStatusLabel,
} from '../../utils/admin-survey-display';

type AdminApprovalsTab = 'registrations' | 'attendance';

const APPROVAL_UNDO_WINDOW_MS = 15 * 60 * 1000;
const SESSION_VISIBLE_BUFFER_MS = 60 * 60 * 1000;

function sessionVisibleUntilMs(program: {
  startDate?: string | null;
  duration?: number | null;
}): number {
  if (!program.startDate) return 0;
  const start = new Date(program.startDate).getTime();
  const durationMs = (program.duration ?? 60) * 60 * 1000;
  return start + durationMs + SESSION_VISIBLE_BUFFER_MS;
}

function undoRemainingMs(undoExpiresAt: string | null | undefined): number {
  if (!undoExpiresAt) return 0;
  return Math.max(0, new Date(undoExpiresAt).getTime() - Date.now());
}

function formatUndoCountdown(ms: number): string {
  const totalSeconds = Math.ceil(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function displayOrNA(value: string | null | undefined): string {
  const t = value?.trim();
  return t ? t : 'N/A';
}

function hcpLabel(specialty?: string | null): string {
  if (!specialty) return 'N/A';
  return HCP_PROFESSIONS.has(specialty) ? 'Yes' : 'No';
}

function hcpBadgeClass(specialty?: string | null): string {
  if (!specialty) return 'bg-gray-100 text-gray-500';
  return HCP_PROFESSIONS.has(specialty)
    ? 'bg-green-50 text-green-800 border border-green-200'
    : 'bg-amber-50 text-amber-800 border border-amber-200';
}

export default function AdminWebinarApprovals() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<AdminApprovalsTab>('registrations');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [rejectModalIds, setRejectModalIds] = useState<string[] | null>(null);
  const [programFilter, setProgramFilter] = useState<string>('all');
  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [emailPrefillEmails, setEmailPrefillEmails] = useState<string[] | undefined>(undefined);

  const { data: rows = [], isLoading, isError } = useQuery({
    queryKey: ['admin', 'webinar-registrations', 'pending'],
    queryFn: () => adminApi.listPendingWebinarRegistrations(),
    enabled: tab === 'registrations',
  });

  const {
    data: recentlyApproved = [],
    isLoading: recentlyApprovedLoading,
  } = useQuery({
    queryKey: ['admin', 'webinar-registrations', 'recently-approved'],
    queryFn: () => adminApi.listRecentlyApprovedWebinarRegistrations(),
    enabled: tab === 'registrations',
    refetchInterval: 30_000,
  });

  const [undoTick, setUndoTick] = useState(0);
  useEffect(() => {
    if (tab !== 'registrations') return;
    const id = window.setInterval(() => setUndoTick((t) => t + 1), 1000);
    return () => window.clearInterval(id);
  }, [tab]);

  const {
    data: attendanceRows = [],
    isLoading: attendanceLoading,
    isError: attendanceError,
  } = useQuery({
    queryKey: ['admin', 'webinar-registrations', 'attendance'],
    queryFn: () => adminApi.listPostEventAttendance(),
    enabled: tab === 'attendance',
  });

  const programOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const r of rows) seen.set(r.program.id, r.program.title);
    for (const r of recentlyApproved) seen.set(r.program.id, r.program.title);
    for (const r of attendanceRows) seen.set(r.program.id, r.program.title);
    return Array.from(seen.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [rows, recentlyApproved, attendanceRows]);

  const filteredRows = useMemo(
    () => (programFilter === 'all' ? rows : rows.filter((r) => r.program.id === programFilter)),
    [rows, programFilter],
  );

  const filteredAttendanceRows = useMemo(
    () => (programFilter === 'all' ? attendanceRows : attendanceRows.filter((r) => r.program.id === programFilter)),
    [attendanceRows, programFilter],
  );

  const filteredRecentlyApproved = useMemo(
    () =>
      programFilter === 'all'
        ? recentlyApproved
        : recentlyApproved.filter((r) => r.program.id === programFilter),
    [recentlyApproved, programFilter],
  );

  const visibleRecentlyApproved = useMemo(
    () =>
      filteredRecentlyApproved.filter((r) => {
        const until = sessionVisibleUntilMs(r.program);
        if (until > 0) return until > Date.now();
        return undoRemainingMs(r.undoExpiresAt) > 0;
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- undoTick drives countdown refresh
    [filteredRecentlyApproved, undoTick],
  );

  const rowIds = useMemo(() => filteredRows.map((r) => r.id), [filteredRows]);

  useEffect(() => {
    setSelectedIds((prev) => {
      const next = new Set<string>();
      for (const id of prev) {
        if (rowIds.includes(id)) next.add(id);
      }
      return next;
    });
  }, [rowIds]);

  const allSelected = filteredRows.length > 0 && filteredRows.every((r) => selectedIds.has(r.id));
  const someSelected = filteredRows.some((r) => selectedIds.has(r.id)) && !allSelected;

  const toggleAll = () => {
    if (allSelected) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        for (const r of filteredRows) next.delete(r.id);
        return next;
      });
    } else {
      setSelectedIds((prev) => new Set([...prev, ...filteredRows.map((r) => r.id)]));
    }
  };

  const toggleOne = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['admin', 'webinar-registrations', 'pending'] });
    queryClient.invalidateQueries({ queryKey: ['admin', 'webinar-registrations', 'recently-approved'] });
    queryClient.invalidateQueries({ queryKey: ['admin', 'webinar-registrations', 'pending-attendance'] });
    queryClient.invalidateQueries({ queryKey: ['admin', 'webinar-registrations', 'attendance'] });
    queryClient.invalidateQueries({ queryKey: ['admin', 'program'] });
  };

  const approveMut = useMutation({
    mutationFn: ({ id }: { id: string }) => adminApi.updateProgramRegistration(id, { status: 'APPROVED' }),
    onSuccess: () => {
      invalidate();
    },
  });

  const rejectMut = useMutation({
    mutationFn: async (o: { ids: string[]; rejectEmailReason: RejectEmailReason; adminNotes: string }) => {
      await Promise.all(
        o.ids.map((id) =>
          adminApi.updateProgramRegistration(id, {
            status: 'REJECTED',
            rejectEmailReason: o.rejectEmailReason,
            adminNotes: o.adminNotes.trim() || null,
          }),
        ),
      );
    },
    onSuccess: (_d, o) => {
      setRejectModalIds(null);
      setSelectedIds((prev) => {
        const next = new Set(prev);
        for (const id of o.ids) next.delete(id);
        return next;
      });
      invalidate();
    },
  });

  const attendanceMut = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'VERIFIED' | 'DENIED' }) =>
      adminApi.updatePostEventAttendance(id, status),
    onSuccess: () => {
      invalidate();
    },
  });

  const undoMut = useMutation({
    mutationFn: (id: string) => adminApi.undoRegistrationApproval(id),
    onSuccess: () => {
      invalidate();
    },
  });

  const bulkMut = useMutation({
    mutationFn: async ({ ids, status }: { ids: string[]; status: 'APPROVED' }) => {
      await Promise.all(ids.map((id) => adminApi.updateProgramRegistration(id, { status })));
    },
    onSuccess: (_data, vars) => {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        for (const id of vars.ids) next.delete(id);
        return next;
      });
      invalidate();
    },
  });

  const busy =
    approveMut.isPending || rejectMut.isPending || bulkMut.isPending || attendanceMut.isPending || undoMut.isPending;
  const selectedList = filteredRows.filter((r) => selectedIds.has(r.id)).map((r) => r.id);
  const selectedRows = useMemo(
    () => filteredRows.filter((r) => selectedIds.has(r.id)),
    [filteredRows, selectedIds],
  );

  const emailTarget = useMemo(() => {
    if (selectedRows.length > 0) {
      const programIds = new Set(selectedRows.map((r) => r.program.id));
      if (programIds.size !== 1) return null;
      const program = selectedRows[0].program;
      return { programId: program.id, programTitle: program.title };
    }
    if (programFilter !== 'all') {
      const title =
        programOptions.find(([id]) => id === programFilter)?.[1] ??
        rows.find((r) => r.program.id === programFilter)?.program.title ??
        'Program';
      return { programId: programFilter, programTitle: title };
    }
    return null;
  }, [selectedRows, programFilter, programOptions, rows]);

  const emailRecipients = useMemo(() => {
    if (!emailTarget) return [];
    const map = new Map<string, { email: string; name: string; status: string }>();
    const consider = (r: {
      status?: string;
      user: { email: string; firstName?: string | null; lastName?: string | null };
      program: { id: string };
    }) => {
      if (r.program.id !== emailTarget.programId) return;
      const email = r.user.email;
      if (!email || map.has(email.toLowerCase())) return;
      map.set(email.toLowerCase(), {
        email,
        name: [r.user.firstName, r.user.lastName].filter(Boolean).join(' ') || email,
        status: r.status ?? 'PENDING',
      });
    };
    for (const r of rows) consider(r);
    for (const r of recentlyApproved) consider({ ...r, status: 'APPROVED' });
    return [...map.values()];
  }, [emailTarget, rows, recentlyApproved]);

  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-16">
      <RejectRegistrationModal
        open={rejectModalIds != null}
        onClose={() => {
          if (!rejectMut.isPending) setRejectModalIds(null);
        }}
        onConfirm={(o) => rejectMut.mutate({ ids: rejectModalIds ?? [], ...o })}
        isSubmitting={rejectMut.isPending}
        count={rejectModalIds?.length ?? 0}
      />
      {emailTarget ? (
        <OperationalEmailModal
          open={emailModalOpen}
          onClose={() => {
            setEmailModalOpen(false);
            setEmailPrefillEmails(undefined);
          }}
          programId={emailTarget.programId}
          programTitle={emailTarget.programTitle}
          recipients={emailRecipients}
          initialSelectedEmails={emailPrefillEmails}
        />
      ) : null}
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Webinar & Office Hours approvals</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Pending registration requests for published Zoom Webinars and Office Hours (Zoom Meetings). Learners can join via Zoom after
          approval. If you <strong>reject</strong> someone, they can register again; their request returns to pending when
          they resubmit.
        </p>
        <div className="mt-4 flex gap-2 border-b border-border">
          <button
            type="button"
            onClick={() => setTab('registrations')}
            className={[
              'border-b-2 px-3 py-2 text-sm font-semibold',
              tab === 'registrations' ? 'border-gray-900 text-foreground' : 'border-transparent text-muted-foreground',
            ].join(' ')}
          >
            Registration requests
          </button>
          <button
            type="button"
            onClick={() => setTab('attendance')}
            className={[
              'border-b-2 px-3 py-2 text-sm font-semibold',
              tab === 'attendance' ? 'border-gray-900 text-foreground' : 'border-transparent text-muted-foreground',
            ].join(' ')}
          >
            Post-event attendance
          </button>
        </div>
        {tab === 'attendance' ? (
          <p className="mt-3 text-sm text-muted-foreground">
            Verify attendance after the live session. Verified and denied learners stay in this list with their status
            so you can audit who was marked.
          </p>
        ) : null}

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <label className="text-sm font-semibold text-muted-foreground shrink-0">Filter by program:</label>
          <select
            value={programFilter}
            onChange={(e) => { setProgramFilter(e.target.value); setSelectedIds(new Set()); }}
            className="rounded-lg border border-border bg-card px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-gray-900"
          >
            <option value="all">All programs</option>
            {programOptions.map(([id, title]) => (
              <option key={id} value={id}>{title}</option>
            ))}
          </select>
          {programFilter !== 'all' && (
            <button
              type="button"
              onClick={() => { setProgramFilter('all'); setSelectedIds(new Set()); }}
              className="text-xs font-semibold text-muted-foreground underline hover:text-foreground"
            >
              Clear
            </button>
          )}
          {tab === 'registrations' && programFilter !== 'all' && emailTarget ? (
            <button
              type="button"
              onClick={() => {
                setEmailPrefillEmails(undefined);
                setEmailModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-muted"
            >
              <Mail className="h-3.5 w-3.5" aria-hidden />
              Email registrants
            </button>
          ) : null}
        </div>
      </div>

      {tab === 'registrations' && isLoading ? (
        <div className="flex justify-center py-20">
          <LoadingSpinner />
        </div>
      ) : null}

      {tab === 'registrations' && isError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-destructive">
          Failed to load pending registrations.
        </div>
      ) : null}

      {tab === 'attendance' && attendanceLoading ? (
        <div className="flex justify-center py-20">
          <LoadingSpinner />
        </div>
      ) : null}

      {tab === 'attendance' && attendanceError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-destructive">
          Failed to load attendance verification queue.
        </div>
      ) : null}

      {tab === 'registrations' && !isLoading && !isError && filteredRows.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-muted px-4 py-3">
          <span className="text-sm text-muted-foreground">
            {selectedIds.size === 0 ? 'Select rows below, or use Select all.' : `${selectedIds.size} selected`}
          </span>
          <div className="ml-auto flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy || selectedList.length === 0}
              onClick={() => bulkMut.mutate({ ids: selectedList, status: 'APPROVED' })}
              className="rounded-lg bg-green-700 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40"
            >
              Approve selected
            </button>
            <button
              type="button"
              disabled={busy || selectedList.length === 0}
              onClick={() => setRejectModalIds([...selectedList])}
              className="rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground disabled:opacity-40"
            >
              Reject selected
            </button>
            <button
              type="button"
              disabled={!emailTarget || (selectedList.length === 0 && programFilter === 'all')}
              onClick={() => {
                setEmailPrefillEmails(
                  selectedRows.length > 0 ? selectedRows.map((r) => r.user.email) : undefined,
                );
                setEmailModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground disabled:opacity-40"
            >
              <Mail className="h-3.5 w-3.5" aria-hidden />
              Email registrants
            </button>
          </div>
        </div>
      ) : null}

      {tab === 'registrations' && (bulkMut.isError || rejectMut.isError) ? (
        <p className="text-sm text-destructive">One or more updates failed. Try again or use row actions.</p>
      ) : null}

      {tab === 'attendance' && attendanceMut.isError ? (
        <p className="text-sm text-destructive">Could not update attendance. Try again.</p>
      ) : null}

      {tab === 'attendance' && !attendanceLoading && !attendanceError ? (
        <div className="overflow-x-auto rounded-card border border-border bg-card">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <th className="py-3 px-4">Program</th>
                <th className="py-3 px-4">Type</th>
                <th className="py-3 px-4">User</th>
                <th className="py-3 px-4">Registration</th>
                <th className="py-3 px-4">Attendance</th>
                <th className="py-3 px-4">Reviewed</th>
                <th className="py-3 px-4">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredAttendanceRows.map((r) => {
                const att = r.postEventAttendanceStatus;
                const isPending = att === 'PENDING_VERIFICATION';
                return (
                <tr key={r.id}>
                  <td className="py-3 px-4">
                    <span className="font-medium text-foreground">{r.program.title}</span>
                    <div className="mt-1">
                      <Link
                        to={`/admin/programs/${r.program.id}/hub`}
                        className="text-xs font-semibold text-muted-foreground hover:text-foreground"
                      >
                        Open program hub
                      </Link>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-muted-foreground whitespace-nowrap">
                    {r.program.zoomSessionType === 'MEETING' ? 'Office Hours' : 'Live webinar'}
                  </td>
                  <td className="py-3 px-4">
                    {r.user.firstName} {r.user.lastName}
                    <div className="text-xs text-muted-foreground">{r.user.email}</div>
                    {r.user.specialty && <div className="text-xs text-muted-foreground">{r.user.specialty}</div>}
                  </td>
                  <td className="py-3 px-4">
                    <span
                      className={[
                        'inline-block rounded-full px-2 py-0.5 text-xs font-semibold',
                        registrationStatusClass(r.status),
                      ].join(' ')}
                    >
                      {registrationStatusLabel(r.status)}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <span
                      className={[
                        'inline-block rounded-full px-2 py-0.5 text-xs font-semibold',
                        att === 'VERIFIED'
                          ? 'bg-green-100 text-green-800'
                          : att === 'DENIED'
                            ? 'bg-red-100 text-red-800'
                            : att === 'PENDING_VERIFICATION'
                              ? 'bg-amber-50 text-amber-800'
                              : 'bg-muted text-muted-foreground',
                      ].join(' ')}
                    >
                      {attendanceStatusLabel(att)}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-muted-foreground whitespace-nowrap text-xs">
                    {r.postEventAttendanceReviewedAt
                      ? format(parseISO(r.postEventAttendanceReviewedAt), 'MMM d, yyyy h:mm a')
                      : '-'}
                  </td>
                  <td className="py-3 px-4">
                    {isPending ? (
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => attendanceMut.mutate({ id: r.id, status: 'VERIFIED' })}
                          className="rounded-lg bg-green-700 px-2 py-1 text-xs font-semibold text-white disabled:opacity-40"
                        >
                          Verify attendance
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => attendanceMut.mutate({ id: r.id, status: 'DENIED' })}
                          className="rounded-lg border border-border px-2 py-1 text-xs font-semibold"
                        >
                          Did not attend
                        </button>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">No action needed</span>
                    )}
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
          {filteredAttendanceRows.length === 0 && (
            <p className="text-sm text-muted-foreground px-4 py-8 text-center">
              {programFilter !== 'all'
                ? 'No attendance records for the selected program.'
                : 'No attendance records yet. Approved learners appear here when post-event verification is required.'}
            </p>
          )}
        </div>
      ) : null}

      {tab === 'registrations' && !recentlyApprovedLoading && visibleRecentlyApproved.length > 0 ? (
        <section className="overflow-x-auto rounded-card border border-amber-200 bg-amber-50/60">
          <div className="border-b border-amber-200 px-4 py-3">
            <h2 className="text-sm font-semibold text-amber-950">Recently approved</h2>
            <p className="mt-0.5 text-xs text-amber-900">
              Shown until each session ends plus one hour. Undo is available for{' '}
              {APPROVAL_UNDO_WINDOW_MS / (60 * 1000)} minutes after approval.
            </p>
          </div>
          <table className="min-w-full text-sm bg-white/80">
            <thead>
              <tr className="border-b border-amber-100 text-left text-muted-foreground">
                <th className="py-3 px-4">Program</th>
                <th className="py-3 px-4">Type</th>
                <th className="py-3 px-4">User</th>
                <th className="py-3 px-4">HCP</th>
                <th className="py-3 px-4">Approved</th>
                <th className="py-3 px-4">Undo window</th>
                <th className="py-3 px-4">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-amber-50">
              {visibleRecentlyApproved.map((r) => {
                const remaining = undoRemainingMs(r.undoExpiresAt);
                return (
                  <tr key={r.id}>
                    <td className="py-3 px-4 font-medium text-foreground">{r.program.title}</td>
                    <td className="py-3 px-4 text-muted-foreground whitespace-nowrap">
                      {r.program.zoomSessionType === 'MEETING' ? 'Office Hours' : 'Live webinar'}
                    </td>
                    <td className="py-3 px-4">
                      {r.user.firstName} {r.user.lastName}
                      <div className="text-xs text-muted-foreground">{r.user.email}</div>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${hcpBadgeClass(r.user.specialty)}`}>
                        {hcpLabel(r.user.specialty)}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-muted-foreground whitespace-nowrap">
                      {r.reviewedAt ? format(parseISO(r.reviewedAt), 'MMM d, yyyy h:mm a') : '-'}
                    </td>
                    <td className="py-3 px-4 text-amber-900 font-mono text-xs whitespace-nowrap">
                      {remaining > 0 ? formatUndoCountdown(remaining) : 'Expired'}
                    </td>
                    <td className="py-3 px-4">
                      <button
                        type="button"
                        disabled={busy || remaining <= 0}
                        onClick={() => undoMut.mutate(r.id)}
                        className="rounded-lg border border-amber-300 bg-card px-2 py-1 text-xs font-semibold text-amber-950 hover:bg-amber-50 disabled:opacity-40"
                      >
                        Undo approval
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      ) : null}

      {tab === 'registrations' && undoMut.isError ? (
        <p className="text-sm text-destructive">Could not undo approval. The window may have expired.</p>
      ) : null}

      {tab === 'registrations' && !isLoading && !isError ? (
      <div className="overflow-x-auto rounded-card border border-border bg-card">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-muted-foreground">
              <th className="w-10 py-3 pl-4 pr-2">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-border"
                  checked={allSelected}
                  ref={(el) => {
                    if (el) el.indeterminate = someSelected;
                  }}
                  onChange={toggleAll}
                  disabled={filteredRows.length === 0 || busy}
                  aria-label="Select all pending registrations"
                />
              </th>
              <th className="py-3 px-4">Program</th>
              <th className="py-3 px-4">Type</th>
              <th className="py-3 px-4">User</th>
              <th className="py-3 px-4">HCP</th>
              <th className="py-3 px-4">Hospital</th>
              <th className="py-3 px-4">City</th>
              <th className="py-3 px-4">Last submitted</th>
              <th className="py-3 px-4">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filteredRows.map((r) => (
              <tr key={r.id}>
                <td className="py-3 pl-4 pr-2">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-border"
                    checked={selectedIds.has(r.id)}
                    onChange={() => toggleOne(r.id)}
                    disabled={busy}
                    aria-label={`Select ${r.user.email}`}
                  />
                </td>
                <td className="py-3 px-4">
                  <span className="font-medium text-foreground">{r.program.title}</span>
                  <div className="mt-1">
                    <Link
                      to={`/admin/programs/${r.program.id}/hub`}
                      className="text-xs font-semibold text-muted-foreground hover:text-foreground"
                    >
                      Open program hub
                    </Link>
                  </div>
                </td>
                <td className="py-3 px-4 text-muted-foreground whitespace-nowrap">
                  {r.program.zoomSessionType === 'MEETING' ? 'Office Hours' : 'Live webinar'}
                </td>
                <td className="py-3 px-4">
                  {r.user.firstName} {r.user.lastName}
                  <div className="text-xs text-muted-foreground">{r.user.email}</div>
                  {r.user.specialty && <div className="text-xs text-muted-foreground">{r.user.specialty}</div>}
                </td>
                <td className="py-3 px-4">
                  <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${hcpBadgeClass(r.user.specialty)}`}>
                    {hcpLabel(r.user.specialty)}
                  </span>
                </td>
                <td className="py-3 px-4 text-muted-foreground">{displayOrNA(r.user.institution)}</td>
                <td className="py-3 px-4 text-muted-foreground">{displayOrNA(r.user.city)}</td>
                <td className="py-3 px-4 text-muted-foreground whitespace-nowrap">
                  {format(parseISO(r.lastSubmittedAt ?? r.createdAt), 'MMM d, yyyy h:mm a')}
                </td>
                <td className="py-3 px-4">
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => approveMut.mutate({ id: r.id })}
                      className="rounded-lg bg-green-700 px-2 py-1 text-xs font-semibold text-white disabled:opacity-40"
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => setRejectModalIds([r.id])}
                      className="rounded-lg border border-border px-2 py-1 text-xs font-semibold"
                    >
                      Reject
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filteredRows.length === 0 && (
          <p className="text-sm text-muted-foreground px-4 py-8 text-center">
            {programFilter !== 'all' ? 'No pending registrations for the selected program.' : 'No pending registrations.'}
          </p>
        )}
      </div>
      ) : null}
    </div>
  );
}
