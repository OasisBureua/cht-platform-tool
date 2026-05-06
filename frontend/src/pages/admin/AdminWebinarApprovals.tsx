import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { adminApi } from '../../api/admin';
import RejectRegistrationModal, { type RejectEmailReason } from '../../components/admin/RejectRegistrationModal';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import { HCP_PROFESSIONS } from '../../data/profession-options';

type AdminApprovalsTab = 'registrations' | 'attendance';

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

  const { data: rows = [], isLoading, isError } = useQuery({
    queryKey: ['admin', 'webinar-registrations', 'pending'],
    queryFn: () => adminApi.listPendingWebinarRegistrations(),
    enabled: tab === 'registrations',
  });

  const {
    data: attendanceRows = [],
    isLoading: attendanceLoading,
    isError: attendanceError,
  } = useQuery({
    queryKey: ['admin', 'webinar-registrations', 'pending-attendance'],
    queryFn: () => adminApi.listPendingPostEventAttendance(),
    enabled: tab === 'attendance',
  });

  const programOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const r of rows) seen.set(r.program.id, r.program.title);
    return Array.from(seen.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [rows]);

  const attendanceProgramOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const r of attendanceRows) seen.set(r.program.id, r.program.title);
    return Array.from(seen.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [attendanceRows]);

  const filteredRows = useMemo(
    () => (programFilter === 'all' ? rows : rows.filter((r) => r.program.id === programFilter)),
    [rows, programFilter],
  );

  const filteredAttendanceRows = useMemo(
    () => (programFilter === 'all' ? attendanceRows : attendanceRows.filter((r) => r.program.id === programFilter)),
    [attendanceRows, programFilter],
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
    queryClient.invalidateQueries({ queryKey: ['admin', 'webinar-registrations', 'pending-attendance'] });
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
    approveMut.isPending || rejectMut.isPending || bulkMut.isPending || attendanceMut.isPending;
  const selectedList = filteredRows.filter((r) => selectedIds.has(r.id)).map((r) => r.id);

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
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Live & office hours approvals</h1>
        <p className="mt-1 text-sm text-gray-600">
          Pending registration requests for published webinars and CHM Office Hours. Learners can join via Zoom after
          approval. If you <strong>reject</strong> someone, they can register again; their request returns to pending when
          they resubmit.
        </p>
        <div className="mt-4 flex gap-2 border-b border-gray-200">
          <button
            type="button"
            onClick={() => setTab('registrations')}
            className={[
              'border-b-2 px-3 py-2 text-sm font-semibold',
              tab === 'registrations' ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-500',
            ].join(' ')}
          >
            Registration requests
          </button>
          <button
            type="button"
            onClick={() => setTab('attendance')}
            className={[
              'border-b-2 px-3 py-2 text-sm font-semibold',
              tab === 'attendance' ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-500',
            ].join(' ')}
          >
            Post-event attendance
          </button>
        </div>
        {tab === 'attendance' ? (
          <p className="mt-3 text-sm text-gray-600">
            After you approve someone for the event, verify they attended so their post-event survey and honorarium steps
            can unlock.
          </p>
        ) : null}

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <label className="text-sm font-semibold text-gray-700 shrink-0">Filter by program:</label>
          <select
            value={programFilter}
            onChange={(e) => { setProgramFilter(e.target.value); setSelectedIds(new Set()); }}
            className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-800 focus:outline-none focus:ring-1 focus:ring-gray-900"
          >
            <option value="all">All programs</option>
            {(tab === 'registrations' ? programOptions : attendanceProgramOptions).map(([id, title]) => (
              <option key={id} value={id}>{title}</option>
            ))}
          </select>
          {programFilter !== 'all' && (
            <button
              type="button"
              onClick={() => { setProgramFilter('all'); setSelectedIds(new Set()); }}
              className="text-xs font-semibold text-gray-500 underline hover:text-gray-800"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {tab === 'registrations' && isLoading ? (
        <div className="flex justify-center py-20">
          <LoadingSpinner />
        </div>
      ) : null}

      {tab === 'registrations' && isError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">
          Failed to load pending registrations.
        </div>
      ) : null}

      {tab === 'attendance' && attendanceLoading ? (
        <div className="flex justify-center py-20">
          <LoadingSpinner />
        </div>
      ) : null}

      {tab === 'attendance' && attendanceError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">
          Failed to load attendance verification queue.
        </div>
      ) : null}

      {tab === 'registrations' && !isLoading && !isError && filteredRows.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
          <span className="text-sm text-gray-700">
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
              className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-800 disabled:opacity-40"
            >
              Reject selected
            </button>
          </div>
        </div>
      ) : null}

      {tab === 'registrations' && (bulkMut.isError || rejectMut.isError) ? (
        <p className="text-sm text-red-600">One or more updates failed. Try again or use row actions.</p>
      ) : null}

      {tab === 'attendance' && attendanceMut.isError ? (
        <p className="text-sm text-red-600">Could not update attendance. Try again.</p>
      ) : null}

      {tab === 'attendance' && !attendanceLoading && !attendanceError ? (
        <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-gray-600">
                <th className="py-3 px-4">Program</th>
                <th className="py-3 px-4">Type</th>
                <th className="py-3 px-4">User</th>
                <th className="py-3 px-4">HCP</th>
                <th className="py-3 px-4">Hospital</th>
                <th className="py-3 px-4">City</th>
                <th className="py-3 px-4">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredAttendanceRows.map((r) => (
                <tr key={r.id}>
                  <td className="py-3 px-4">
                    <span className="font-medium text-gray-900">{r.program.title}</span>
                    <div className="mt-1">
                      <Link
                        to={`/admin/programs/${r.program.id}/hub`}
                        className="text-xs font-semibold text-gray-600 hover:text-gray-900"
                      >
                        Open program hub
                      </Link>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-gray-700 whitespace-nowrap">
                    {r.program.zoomSessionType === 'MEETING' ? 'Office Hours' : 'Live webinar'}
                  </td>
                  <td className="py-3 px-4">
                    {r.user.firstName} {r.user.lastName}
                    <div className="text-xs text-gray-500">{r.user.email}</div>
                    {r.user.specialty && <div className="text-xs text-gray-400">{r.user.specialty}</div>}
                  </td>
                  <td className="py-3 px-4">
                    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${hcpBadgeClass(r.user.specialty)}`}>
                      {hcpLabel(r.user.specialty)}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-gray-700">{displayOrNA(r.user.institution)}</td>
                  <td className="py-3 px-4 text-gray-700">{displayOrNA(r.user.city)}</td>
                  <td className="py-3 px-4">
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
                        className="rounded-lg border border-gray-300 px-2 py-1 text-xs font-semibold"
                      >
                        Did not attend
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredAttendanceRows.length === 0 && (
            <p className="text-sm text-gray-500 px-4 py-8 text-center">
              {programFilter !== 'all' ? 'No attendance records for the selected program.' : 'No registrations waiting for attendance verification.'}
            </p>
          )}
        </div>
      ) : null}

      {tab === 'registrations' && !isLoading && !isError ? (
      <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-left text-gray-600">
              <th className="w-10 py-3 pl-4 pr-2">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-gray-300"
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
                    className="h-4 w-4 rounded border-gray-300"
                    checked={selectedIds.has(r.id)}
                    onChange={() => toggleOne(r.id)}
                    disabled={busy}
                    aria-label={`Select ${r.user.email}`}
                  />
                </td>
                <td className="py-3 px-4">
                  <span className="font-medium text-gray-900">{r.program.title}</span>
                  <div className="mt-1">
                    <Link
                      to={`/admin/programs/${r.program.id}/hub`}
                      className="text-xs font-semibold text-gray-600 hover:text-gray-900"
                    >
                      Open program hub
                    </Link>
                  </div>
                </td>
                <td className="py-3 px-4 text-gray-700 whitespace-nowrap">
                  {r.program.zoomSessionType === 'MEETING' ? 'Office Hours' : 'Live webinar'}
                </td>
                <td className="py-3 px-4">
                  {r.user.firstName} {r.user.lastName}
                  <div className="text-xs text-gray-500">{r.user.email}</div>
                  {r.user.specialty && <div className="text-xs text-gray-400">{r.user.specialty}</div>}
                </td>
                <td className="py-3 px-4">
                  <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${hcpBadgeClass(r.user.specialty)}`}>
                    {hcpLabel(r.user.specialty)}
                  </span>
                </td>
                <td className="py-3 px-4 text-gray-700">{displayOrNA(r.user.institution)}</td>
                <td className="py-3 px-4 text-gray-700">{displayOrNA(r.user.city)}</td>
                <td className="py-3 px-4 text-gray-600 whitespace-nowrap">
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
                      className="rounded-lg border border-gray-300 px-2 py-1 text-xs font-semibold"
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
          <p className="text-sm text-gray-500 px-4 py-8 text-center">
            {programFilter !== 'all' ? 'No pending registrations for the selected program.' : 'No pending registrations.'}
          </p>
        )}
      </div>
      ) : null}
    </div>
  );
}
