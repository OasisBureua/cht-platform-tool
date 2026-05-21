import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useLocation, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format, isPast } from 'date-fns';
import { ChevronLeft, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { webinarsApi, type WebinarItem } from '../api/webinars';
import { programsApi } from '../api/programs';
import { useAuth } from '../contexts/AuthContext';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import { getApiErrorMessage } from '../api/client';
import { buildIntakeFormUrl } from '../utils/jotform-intake-prefill';
import { MULTI_WEBINAR_REGISTER_PUBLIC } from '../config/features';
import {
  buildMultiRegisterHref,
  clearMultiRegisterState,
  loadMultiRegisterState,
  readIntakeSubmissionIdFromSearch,
  readMultiRegisterIntakeProgramId,
  readMultiRegisterProgramIds,
  saveMultiRegisterState,
  type MultiRegisterPersistedState,
} from '../utils/intake-return';

type WizardPhase = 'select' | 'intake' | 'review' | 'result';

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

function hasIntakeForm(w: WebinarItem): boolean {
  return !!w.jotformIntakeFormUrl?.trim();
}

export default function LiveMultiRegister() {
  const queryClient = useQueryClient();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();

  const [phase, setPhase] = useState<WizardPhase>('select');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [intakeByProgramId, setIntakeByProgramId] = useState<Record<string, string>>({});
  const [intakeIndex, setIntakeIndex] = useState(0);
  const [maxIntakeIndexCompleted, setMaxIntakeIndexCompleted] = useState(-1);
  const [hydrated, setHydrated] = useState(false);

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

  const webinarById = useMemo(() => {
    const m = new Map<string, WebinarItem>();
    for (const w of webinars) m.set(w.id, w);
    return m;
  }, [webinars]);

  const selectedWebinars = useMemo(
    () =>
      [...selected]
        .map((id) => webinarById.get(id))
        .filter((w): w is WebinarItem => !!w),
    [selected, webinarById],
  );

  const intakePrograms = useMemo(
    () => selectedWebinars.filter(hasIntakeForm),
    [selectedWebinars],
  );

  const currentIntakeProgram = intakePrograms[intakeIndex];

  const persistWizard = useCallback(
    (overrides?: Partial<MultiRegisterPersistedState>) => {
      if (phase === 'result') return;
      saveMultiRegisterState({
        selectedIds: [...selected],
        intakeByProgramId,
        maxIntakeIndexCompleted,
        phase: phase === 'result' ? 'review' : phase,
        intakeIndex,
        ...overrides,
      });
    },
    [selected, intakeByProgramId, maxIntakeIndexCompleted, phase, intakeIndex],
  );

  useEffect(() => {
    if (hydrated || isLoading) return;
    const stored = loadMultiRegisterState();
    const submissionId = readIntakeSubmissionIdFromSearch(location.search);
    const intakeProgramId = readMultiRegisterIntakeProgramId(location.search);
    const preselectedPrograms = readMultiRegisterProgramIds(location.search);

    let nextSelected = new Set(stored?.selectedIds ?? []);
    for (const id of preselectedPrograms) nextSelected.add(id);
    let nextIntake = { ...(stored?.intakeByProgramId ?? {}) };
    let nextPhase: WizardPhase = stored?.phase ?? 'select';
    let nextIntakeIndex = stored?.intakeIndex ?? 0;
    let nextMaxCompleted = stored?.maxIntakeIndexCompleted ?? -1;

    if (submissionId && intakeProgramId) {
      nextIntake[intakeProgramId] = submissionId;
      nextSelected.add(intakeProgramId);
      nextPhase = 'intake';
      const intakeOrderedIds = [...nextSelected]
        .map((id) => webinarById.get(id))
        .filter((w): w is WebinarItem => !!w && hasIntakeForm(w))
        .map((w) => w.id);
      const idx = intakeOrderedIds.indexOf(intakeProgramId);
      nextIntakeIndex = idx >= 0 ? idx : 0;
    }

    setSelected(nextSelected);
    setIntakeByProgramId(nextIntake);
    setPhase(nextPhase);
    setIntakeIndex(nextIntakeIndex);
    setMaxIntakeIndexCompleted(nextMaxCompleted);
    setHydrated(true);

    if (submissionId || intakeProgramId || preselectedPrograms.length > 0) {
      const next = new URLSearchParams(searchParams);
      next.delete('submission_id');
      next.delete('submissionId');
      next.delete('submissionID');
      next.delete('jid');
      next.delete('sid');
      next.delete('submission');
      next.delete('intakeProgramId');
      next.delete('programs');
      setSearchParams(next, { replace: true });
    }
  }, [hydrated, isLoading, location.search, searchParams, setSearchParams, webinarById]);

  useEffect(() => {
    if (!hydrated || phase === 'result') return;
    persistWizard();
  }, [hydrated, phase, selected, intakeByProgramId, intakeIndex, maxIntakeIndexCompleted, persistWizard]);

  const { data: intakeJotformResume } = useQuery({
    queryKey: ['program', currentIntakeProgram?.id, 'jotform-resume', 'multi'],
    queryFn: () => programsApi.getJotformResume(currentIntakeProgram!.id),
    enabled: phase === 'intake' && !!currentIntakeProgram?.id,
  });

  useEffect(() => {
    const sid = searchParams.get('session') || searchParams.get('jotform_session');
    if (!sid?.trim() || phase !== 'intake' || !currentIntakeProgram?.id || !user?.userId) return;
    let cancelled = false;
    (async () => {
      try {
        await programsApi.putJotformResume(currentIntakeProgram.id, sid.trim());
        if (!cancelled) {
          queryClient.invalidateQueries({
            queryKey: ['program', currentIntakeProgram.id, 'jotform-resume', 'multi'],
          });
          const next = new URLSearchParams(searchParams);
          next.delete('session');
          next.delete('jotform_session');
          setSearchParams(next, { replace: true });
        }
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    searchParams,
    phase,
    currentIntakeProgram?.id,
    user?.userId,
    queryClient,
    setSearchParams,
  ]);

  const submitMut = useMutation({
    mutationFn: () =>
      programsApi.submitBatchRegistrations([...selected], intakeByProgramId),
    onSuccess: (data) => {
      setResult(data);
      setPhase('result');
      clearMultiRegisterState();
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

  const selectAll = () => setSelected(new Set(upcoming.map((w) => w.id)));
  const clearAll = () => setSelected(new Set());

  const continueFromSelect = () => {
    if (selected.size === 0) return;
    if (intakePrograms.length === 0) {
      setPhase('review');
      return;
    }
    setIntakeIndex(0);
    setMaxIntakeIndexCompleted(-1);
    setPhase('intake');
  };

  const continueFromIntake = () => {
    setMaxIntakeIndexCompleted((prev) => Math.max(prev, intakeIndex));
    if (intakeIndex < intakePrograms.length - 1) {
      setIntakeIndex((i) => i + 1);
      return;
    }
    setPhase('review');
  };

  const stepLabels = useMemo(() => {
    const labels = ['Select sessions'];
    for (const w of intakePrograms) {
      labels.push(`Intake: ${w.title.length > 28 ? `${w.title.slice(0, 28)}…` : w.title}`);
    }
    labels.push('Review & submit');
    return labels;
  }, [intakePrograms]);

  const activeStepIndex = useMemo(() => {
    if (phase === 'select') return 0;
    if (phase === 'intake') return 1 + intakeIndex;
    if (phase === 'review') return stepLabels.length - 1;
    return 0;
  }, [phase, intakeIndex, stepLabels.length]);

  const intakeReturnUrl = useMemo(() => {
    if (!currentIntakeProgram?.id || typeof window === 'undefined') return '';
    const href = buildMultiRegisterHref({
      intakeProgramId: currentIntakeProgram.id,
      programIds: [...selected],
    });
    return `${window.location.origin}${href}`;
  }, [currentIntakeProgram?.id]);

  const intakeFormSrc = useMemo(() => {
    if (!currentIntakeProgram?.jotformIntakeFormUrl?.trim()) return '';
    return buildIntakeFormUrl(currentIntakeProgram.jotformIntakeFormUrl, {
      returnRedirect: intakeReturnUrl || undefined,
      userId: user?.userId || undefined,
      programId: currentIntakeProgram.id,
      jotformSessionId: intakeJotformResume?.sessionId,
    });
  }, [currentIntakeProgram, intakeReturnUrl, user?.userId, intakeJotformResume?.sessionId]);

  const currentIntakeSubmissionId = currentIntakeProgram
    ? intakeByProgramId[currentIntakeProgram.id]?.trim()
    : undefined;

  const hasInviteContext =
    readMultiRegisterProgramIds(location.search).length > 0 ||
    !!readMultiRegisterIntakeProgramId(location.search) ||
    (loadMultiRegisterState()?.selectedIds.length ?? 0) > 0;
  const allowAccess = MULTI_WEBINAR_REGISTER_PUBLIC || hasInviteContext;

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

  if (!allowAccess) {
    return <Navigate to="/app/live" replace />;
  }

  if (isLoading || !hydrated) return <LoadingSpinner />;

  return (
    <div className="mx-auto max-w-2xl space-y-6 pb-24">
      {phase === 'select' ? (
        <Link
          to="/app/live"
          className="inline-flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-gray-900"
        >
          <ChevronLeft className="h-4 w-4" />
          Back to LIVE
        </Link>
      ) : phase !== 'result' ? (
        <p className="text-xs text-gray-500">
          Complete each step in order. After you click <strong>Continue</strong> on an intake form, you cannot go back
          to change that session&apos;s answers.
        </p>
      ) : null}

      <header className="space-y-2">
        <h1 className="text-2xl font-bold text-gray-900">Register for multiple webinars</h1>
        <p className="text-sm text-gray-600">
          {phase === 'select'
            ? 'Select upcoming sessions, then complete each session’s intake form when prompted before submitting your registration requests.'
            : phase === 'intake'
              ? 'Complete the intake form for each selected session. Use Continue when done — you won’t be able to return to a previous intake step.'
              : phase === 'review'
                ? 'Review your selections and submit. Intake answers are locked for sessions you already continued past.'
                : 'Registration summary'}
        </p>
      </header>

      {phase !== 'result' && stepLabels.length > 1 ? (
        <ol className="flex flex-wrap gap-2 text-xs">
          {stepLabels.map((label, i) => (
            <li
              key={label}
              className={[
                'rounded-full px-3 py-1 font-semibold',
                i === activeStepIndex
                  ? 'bg-brand-600 text-white'
                  : i < activeStepIndex
                    ? 'bg-green-100 text-green-900'
                    : 'bg-gray-100 text-gray-600',
              ].join(' ')}
            >
              {i + 1}. {label}
            </li>
          ))}
        </ol>
      ) : null}

      {phase === 'result' && result ? (
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
              onClick={() => {
                setResult(null);
                setPhase('select');
                setIntakeByProgramId({});
                setIntakeIndex(0);
                setMaxIntakeIndexCompleted(-1);
                clearMultiRegisterState();
              }}
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
      ) : null}

      {phase === 'select' ? (
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
                        {hasIntakeForm(w) ? (
                          <span className="mt-1 inline-block text-xs font-medium text-amber-800">
                            Intake form required before submit
                          </span>
                        ) : null}
                        {w.registrationRequiresApproval ? (
                          <span className="mt-1 ml-2 inline-block text-xs font-medium text-amber-800">
                            Requires admin approval
                          </span>
                        ) : null}
                      </span>
                    </label>
                  </li>
                ))}
              </ul>

              <button
                type="button"
                disabled={selected.size === 0}
                onClick={continueFromSelect}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 py-3 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
              >
                Continue
              </button>
            </>
          )}
        </>
      ) : null}

      {phase === 'intake' && currentIntakeProgram ? (
        <div className="rounded-2xl border border-gray-200 bg-white p-6 space-y-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              Intake {intakeIndex + 1} of {intakePrograms.length}
            </p>
            <h2 className="mt-1 text-lg font-semibold text-gray-900">{currentIntakeProgram.title}</h2>
            {currentIntakeProgram.startTime ? (
              <p className="mt-1 text-sm text-gray-600">
                {format(new Date(currentIntakeProgram.startTime), 'EEE, MMM d, yyyy · h:mm a')}
              </p>
            ) : null}
          </div>

          <p className="text-sm text-gray-700">
            Complete the intake form below for this session. Submit the form, then click{' '}
            <strong>Continue</strong> to move on — you won&apos;t be able to return to this step afterward.
          </p>

          {currentIntakeSubmissionId ? (
            <p className="text-xs font-medium text-green-800 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
              Intake submission recorded for this session. Click <strong>Continue</strong> to proceed to the next step.
            </p>
          ) : null}

          {intakeIndex <= maxIntakeIndexCompleted ? (
            <p className="text-xs text-amber-900 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              You already continued past this intake step. Answers are locked — complete the remaining steps below.
            </p>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-gray-600">
                Submit the form below, or{' '}
                <a
                  href={intakeFormSrc}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold text-gray-900 underline"
                >
                  open it in a new tab
                </a>
                .
              </p>
              <div className="min-h-[420px] w-full overflow-hidden rounded-xl border border-gray-200 bg-gray-50">
                <iframe
                  title={`Intake form — ${currentIntakeProgram.title}`}
                  src={intakeFormSrc}
                  className="h-[480px] w-full"
                  allow="camera; microphone"
                />
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={continueFromIntake}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 py-3 text-sm font-semibold text-white hover:bg-brand-700"
          >
            Continue
          </button>
        </div>
      ) : null}

      {phase === 'review' ? (
        <div className="rounded-2xl border border-gray-200 bg-white p-6 space-y-4">
          <h2 className="font-semibold text-gray-900">Review & submit</h2>
          <ul className="divide-y divide-gray-100 rounded-xl border border-gray-200">
            {selectedWebinars.map((w) => {
              const intakeDone = !hasIntakeForm(w) || !!intakeByProgramId[w.id]?.trim();
              return (
                <li key={w.id} className="px-4 py-3 text-sm">
                  <p className="font-medium text-gray-900">{w.title}</p>
                  {w.startTime ? (
                    <p className="text-gray-600">
                      {format(new Date(w.startTime), 'EEE, MMM d, yyyy · h:mm a')}
                    </p>
                  ) : null}
                  {hasIntakeForm(w) ? (
                    <p
                      className={[
                        'mt-1 text-xs font-medium',
                        intakeDone ? 'text-green-800' : 'text-amber-800',
                      ].join(' ')}
                    >
                      {intakeDone ? 'Intake completed' : 'Intake not completed — you can still submit'}
                    </p>
                  ) : null}
                </li>
              );
            })}
          </ul>

          {intakePrograms.some((w) => !intakeByProgramId[w.id]?.trim()) ? (
            <p className="text-xs text-amber-900 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              Some sessions are missing intake submissions. You can submit anyway, but complete intake when possible
              so your answers stay on file.
            </p>
          ) : null}

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
        </div>
      ) : null}
    </div>
  );
}
