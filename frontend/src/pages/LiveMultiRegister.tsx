import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format, isPast } from 'date-fns';
import { ChevronLeft, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { webinarsApi, type WebinarItem } from '../api/webinars';
import { programsApi } from '../api/programs';
import { useAuth } from '../contexts/AuthContext';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import { getApiErrorMessage } from '../api/client';

function isExpired(w: WebinarItem): boolean {
  if (!w.startTime) return false;
  return isPast(new Date(w.startTime));
}

function canBulkRegister(
  programId: string,
  statusByProgramId: Map<string, { enrolled: boolean; registrationStatus: string | null }>,
): boolean {
  const s = statusByProgramId.get(programId);
  if (!s) return true;
  if (s.enrolled) return false;
  if (s.registrationStatus === 'PENDING' || s.registrationStatus === 'APPROVED') {
    return false;
  }
  return true;
}

export default function LiveMultiRegister() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [result, setResult] = useState<Awaited<
    ReturnType<typeof programsApi.submitBatchRegistrations>
  > | null>(null);

  const { data: webinars = [], isLoading } = useQuery({
    queryKey: ['webinars'],
    queryFn: webinarsApi.list,
    staleTime: 60 * 1000,
  });

  const { data: liveStatuses = [] } = useQuery({
    queryKey: ['programs', 'me', 'live-session-status'],
    queryFn: () => programsApi.getMyLiveSessionStatus(),
    enabled: !!user?.userId,
  });

  const statusByProgramId = useMemo(() => {
    const m = new Map<string, (typeof liveStatuses)[0]>();
    for (const s of liveStatuses) m.set(s.programId, s);
    return m;
  }, [liveStatuses]);

  const upcoming = useMemo(() => {
    return webinars
      .filter((w) => !isExpired(w))
      .filter((w) => canBulkRegister(w.id, statusByProgramId))
      .sort((a, b) => {
        const ta = a.startTime ? new Date(a.startTime).getTime() : 0;
        const tb = b.startTime ? new Date(b.startTime).getTime() : 0;
        return ta - tb;
      });
  }, [webinars, statusByProgramId]);

  const submitMut = useMutation({
    mutationFn: () => programsApi.submitBatchRegistrations([...selected]),
    onSuccess: (data) => {
      setResult(data);
      queryClient.invalidateQueries({ queryKey: ['programs', 'me', 'live-session-status'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'webinar-registrations', 'pending'] });
      setSelected(new Set());
    },
  });

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    setSelected(new Set(upcoming.map((w) => w.id)));
  };

  const clearAll = () => setSelected(new Set());

  if (!user?.userId) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-gray-50 p-8 text-center">
        <p className="text-gray-700">Sign in to register for live webinars.</p>
        <Link to="/login" className="mt-4 inline-block font-semibold text-brand-600 underline">
          Sign in
        </Link>
      </div>
    );
  }

  if (isLoading) return <LoadingSpinner />;

  return (
    <div className="mx-auto max-w-2xl space-y-6 pb-24">
      <Link
        to="/app/live"
        className="inline-flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-gray-900"
      >
        <ChevronLeft className="h-4 w-4" />
        Back to LIVE
      </Link>

      <header className="space-y-2">
        <h1 className="text-2xl font-bold text-gray-900">Register for multiple webinars</h1>
        <p className="text-sm text-gray-600">
          Select one or more upcoming sessions, then submit. Each selection sends an approval request to
          administrators when required. You can complete each session&apos;s Jotform intake from its session page
          afterward.
        </p>
      </header>

      {result ? (
        <div className="rounded-2xl border border-gray-200 bg-white p-6 space-y-4">
          <h2 className="font-semibold text-gray-900">Registration summary</h2>
          {result.submitted.length > 0 ? (
            <div className="rounded-xl bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-950">
              <p className="font-semibold flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4" />
                {result.submitted.length} request{result.submitted.length === 1 ? '' : 's'} submitted
              </p>
              <ul className="mt-2 list-disc pl-5 space-y-1">
                {result.submitted.map((r) => (
                  <li key={r.programId}>
                    <Link to={`/app/live/${r.programId}`} className="underline font-medium">
                      {r.title}
                    </Link>
                    {' — '}
                    {r.status === 'APPROVED' ? 'Approved' : 'Pending approval'}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {result.skipped.length > 0 ? (
            <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-950">
              <p className="font-semibold">Skipped</p>
              <ul className="mt-2 list-disc pl-5 space-y-1">
                {result.skipped.map((r) => (
                  <li key={r.programId}>
                    {r.title}: {r.reason}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {result.failed.length > 0 ? (
            <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-950">
              <p className="font-semibold flex items-center gap-2">
                <AlertCircle className="h-4 w-4" />
                Could not submit
              </p>
              <ul className="mt-2 list-disc pl-5 space-y-1">
                {result.failed.map((r) => (
                  <li key={r.programId}>
                    {r.title}: {r.message}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <div className="flex flex-wrap gap-3 pt-2">
            <button
              type="button"
              onClick={() => setResult(null)}
              className="rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700"
            >
              Register for more
            </button>
            <Link
              to="/app/live"
              className="rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-800 hover:bg-gray-50"
            >
              Back to LIVE
            </Link>
          </div>
        </div>
      ) : (
        <>
          {upcoming.length === 0 ? (
            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-8 text-center">
              <p className="font-medium text-gray-900">No sessions available</p>
              <p className="mt-1 text-sm text-gray-600">
                You may already be registered or pending for all upcoming webinars.
              </p>
              <Link
                to="/app/live"
                className="mt-4 inline-block text-sm font-semibold text-brand-600 underline"
              >
                View all sessions
              </Link>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-gray-600">
                  {selected.size} of {upcoming.length} selected
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={selectAll}
                    className="text-sm font-medium text-brand-600 hover:underline"
                  >
                    Select all
                  </button>
                  <span className="text-gray-300">|</span>
                  <button
                    type="button"
                    onClick={clearAll}
                    disabled={selected.size === 0}
                    className="text-sm font-medium text-gray-600 hover:underline disabled:opacity-40"
                  >
                    Clear
                  </button>
                </div>
              </div>

              <ul className="divide-y divide-gray-100 overflow-hidden rounded-2xl border border-gray-200 bg-white">
                {upcoming.map((w) => (
                  <li key={w.id}>
                    <label className="flex cursor-pointer items-start gap-3 px-4 py-4 hover:bg-gray-50">
                      <input
                        type="checkbox"
                        checked={selected.has(w.id)}
                        onChange={() => toggle(w.id)}
                        className="mt-1 h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block font-medium text-gray-900">{w.title}</span>
                        {w.startTime ? (
                          <span className="mt-0.5 block text-sm text-gray-600">
                            {format(new Date(w.startTime), 'EEE, MMM d, yyyy · h:mm a')}
                          </span>
                        ) : null}
                        {w.registrationRequiresApproval ? (
                          <span className="mt-1 inline-block text-xs font-medium text-amber-800">
                            Requires admin approval
                          </span>
                        ) : null}
                      </span>
                    </label>
                  </li>
                ))}
              </ul>

              {submitMut.isError ? (
                <p className="text-sm text-red-600">{getApiErrorMessage(submitMut.error)}</p>
              ) : null}

              <button
                type="button"
                disabled={selected.size === 0 || submitMut.isPending}
                onClick={() => submitMut.mutate()}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 py-3 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
              >
                {submitMut.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Submitting…
                  </>
                ) : (
                  `Submit ${selected.size} registration request${selected.size === 1 ? '' : 's'}`
                )}
              </button>
            </>
          )}
        </>
      )}
    </div>
  );
}
