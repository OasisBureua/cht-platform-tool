import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { adminApi } from '../../api/admin';
import LoadingSpinner from '../../components/ui/LoadingSpinner';

export default function AdminWebinarApprovals() {
  const queryClient = useQueryClient();

  const { data: rows = [], isLoading, isError } = useQuery({
    queryKey: ['admin', 'webinar-registrations', 'pending'],
    queryFn: () => adminApi.listPendingWebinarRegistrations(),
  });

  const approveMut = useMutation({
    mutationFn: ({
      id,
      status,
      bypassIntakeRequirement,
    }: {
      id: string;
      status: 'APPROVED' | 'REJECTED';
      bypassIntakeRequirement?: boolean;
    }) =>
      adminApi.updateProgramRegistration(id, {
        status,
        ...(bypassIntakeRequirement ? { bypassIntakeRequirement: true } : {}),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'webinar-registrations', 'pending'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'program'] });
    },
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <LoadingSpinner />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">
        Failed to load pending registrations.
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-16">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">LIVE & Office Hours approvals</h1>
        <p className="mt-1 text-sm text-gray-600">
          Pending registration requests for published webinars and CHM Office Hours. For programs with a Jotform intake
          URL, approve after a submission ID is on file when possible. Use{' '}
          <strong>Supersede &amp; approve anyway</strong> only if you verified the learner another way. Learners can join
          via Zoom after approval. If you <strong>reject</strong> someone, they can go through registration again; their
          request returns to pending when they resubmit.
        </p>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-left text-gray-600">
              <th className="py-3 px-4">Program</th>
              <th className="py-3 px-4">Type</th>
              <th className="py-3 px-4">User</th>
              <th className="py-3 px-4">Submitted</th>
              <th className="py-3 px-4">Intake</th>
              <th className="py-3 px-4">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map((r) => {
              const intakeRequired = !!r.program.jotformIntakeFormUrl?.trim();
              const canApprove = !intakeRequired || r.intakeComplete;
              return (
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
                    {r.program.zoomSessionType === 'MEETING' ? 'Office Hours' : 'LIVE webinar'}
                  </td>
                  <td className="py-3 px-4">
                    {r.user.firstName} {r.user.lastName}
                    <div className="text-xs text-gray-500">{r.user.email}</div>
                  </td>
                  <td className="py-3 px-4 text-gray-600 whitespace-nowrap">
                    {format(parseISO(r.createdAt), 'MMM d, yyyy h:mm a')}
                  </td>
                  <td className="py-3 px-4">
                    {intakeRequired ? (
                      <span
                        className={
                          r.intakeComplete
                            ? 'font-medium text-green-800'
                            : 'font-medium text-amber-800'
                        }
                      >
                        {r.intakeComplete ? 'Complete' : 'Missing ID'}
                      </span>
                    ) : (
                      <span className="text-gray-500">—</span>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={!canApprove || approveMut.isPending}
                        title={
                          !canApprove
                            ? 'Learner must complete intake Jotform and submit registration with submission ID'
                            : undefined
                        }
                        onClick={() => approveMut.mutate({ id: r.id, status: 'APPROVED' })}
                        className="rounded-lg bg-green-700 px-2 py-1 text-xs font-semibold text-white disabled:opacity-40"
                      >
                        Approve
                      </button>
                      {intakeRequired && !r.intakeComplete && (
                        <button
                          type="button"
                          disabled={approveMut.isPending}
                          title="Supersede intake requirement and approve without a Jotform submission ID on file"
                          onClick={() => {
                            if (
                              !window.confirm(
                                'Supersede the intake requirement and approve anyway? The Jotform submission ID will not be on file. Use only if you verified this learner another way.',
                              )
                            ) {
                              return;
                            }
                            approveMut.mutate({
                              id: r.id,
                              status: 'APPROVED',
                              bypassIntakeRequirement: true,
                            });
                          }}
                          className="rounded-lg border border-amber-300 bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-900"
                        >
                          Supersede &amp; approve anyway
                        </button>
                      )}
                      <button
                        type="button"
                        disabled={approveMut.isPending}
                        onClick={() => approveMut.mutate({ id: r.id, status: 'REJECTED' })}
                        className="rounded-lg border border-gray-300 px-2 py-1 text-xs font-semibold"
                      >
                        Reject
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {rows.length === 0 && (
          <p className="text-sm text-gray-500 px-4 py-8 text-center">No pending registrations.</p>
        )}
      </div>
    </div>
  );
}
