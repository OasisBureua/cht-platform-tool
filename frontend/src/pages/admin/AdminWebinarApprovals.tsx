import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { adminApi } from '../../api/admin';
import LoadingSpinner from '../../components/ui/LoadingSpinner';

type AdminApprovalsTab = 'registrations' | 'attendance';

export default function AdminWebinarApprovals() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<AdminApprovalsTab>('registrations');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());

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

  const rowIds = useMemo(() => rows.map((r) => r.id), [rows]);

  useEffect(() => {
    setSelectedIds((prev) => {
      const next = new Set<string>();
      for (const id of prev) {
        if (rowIds.includes(id)) next.add(id);
      }
      return next;
    });
  }, [rowIds]);

  const allSelected = rows.length > 0 && selectedIds.size === rows.length;
  const someSelected = selectedIds.size > 0 && !allSelected;

  const toggleAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(rows.map((r) => r.id)));
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
    mutationFn: ({ id, status }: { id: string; status: 'APPROVED' | 'REJECTED' }) =>
      adminApi.updateProgramRegistration(id, { status }),
    onSuccess: () => {
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
    mutationFn: async ({ ids, status }: { ids: string[]; status: 'APPROVED' | 'REJECTED' }) => {
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

  const busy = approveMut.isPending || bulkMut.isPending || attendanceMut.isPending;
  const selectedList = rows.filter((r) => selectedIds.has(r.id)).map((r) => r.id);

  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-16">
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

      {tab === 'registrations' && !isLoading && !isError && rows.length > 0 ? (
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
              onClick={() => bulkMut.mutate({ ids: selectedList, status: 'REJECTED' })}
              className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-800 disabled:opacity-40"
            >
              Reject selected
            </button>
          </div>
        </div>
      ) : null}

      {tab === 'registrations' && bulkMut.isError ? (
        <p className="text-sm text-red-600">One or more updates failed. Try again or approve rows individually.</p>
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
                <th className="py-3 px-4">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {attendanceRows.map((r) => (
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
                  </td>
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
          {attendanceRows.length === 0 && (
            <p className="text-sm text-gray-500 px-4 py-8 text-center">No registrations waiting for attendance verification.</p>
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
                  disabled={rows.length === 0 || busy}
                  aria-label="Select all pending registrations"
                />
              </th>
              <th className="py-3 px-4">Program</th>
              <th className="py-3 px-4">Type</th>
              <th className="py-3 px-4">User</th>
              <th className="py-3 px-4">Last submitted</th>
              <th className="py-3 px-4">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map((r) => (
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
                </td>
                <td className="py-3 px-4 text-gray-600 whitespace-nowrap">
                  {format(parseISO(r.lastSubmittedAt ?? r.createdAt), 'MMM d, yyyy h:mm a')}
                </td>
                <td className="py-3 px-4">
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => approveMut.mutate({ id: r.id, status: 'APPROVED' })}
                      className="rounded-lg bg-green-700 px-2 py-1 text-xs font-semibold text-white disabled:opacity-40"
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => approveMut.mutate({ id: r.id, status: 'REJECTED' })}
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
        {rows.length === 0 && (
          <p className="text-sm text-gray-500 px-4 py-8 text-center">No pending registrations.</p>
        )}
      </div>
      ) : null}
    </div>
  );
}
