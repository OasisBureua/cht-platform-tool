import { useMemo, useState, useEffect } from 'react';
import { Link, useNavigate, useParams, useLocation, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { programsApi, type Program } from '../api/programs';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import { ChevronLeft, Loader2 } from 'lucide-react';
import { OfficeHoursSlotPicker } from '../components/office-hours/OfficeHoursSlotPicker';
import { useAuth } from '../contexts/AuthContext';
import { buildProgramRegisterHref, readIntakeSubmissionIdFromSearch } from '../utils/intake-return';
import { buildIntakeFormUrl, buildJotformThankYouRedirectTemplate } from '../utils/jotform-intake-prefill';

type StepKey = 'intake' | 'slot' | 'submit';

function buildSteps(p: Program, hasSlots: boolean): StepKey[] {
  const steps: StepKey[] = [];
  if (p.jotformIntakeFormUrl?.trim()) steps.push('intake');
  if (hasSlots) steps.push('slot');
  steps.push('submit');
  return steps;
}

export default function ProgramRegisterWizard() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const userId = user?.userId;
  const [intakeSubmissionId, setIntakeSubmissionId] = useState<string | undefined>();
  const isOfficeHours = location.pathname.includes('/office-hours/') || location.pathname.includes('/chm-office-hours/');
  const backHref = isOfficeHours ? `/app/chm-office-hours/${id}` : `/app/live/${id}`;

  /** Jotform must redirect here (with submission id) so this page can read it — not the session detail URL. */
  const registerHref = id ? buildProgramRegisterHref(id, location.pathname) : '';
  const returnUrl =
    typeof window !== 'undefined' && registerHref ? `${window.location.origin}${registerHref}` : '';

  const { data: program, isLoading, isError } = useQuery({
    queryKey: ['program', id],
    queryFn: () => programsApi.getById(id!),
    enabled: !!id,
    retry: false,
  });

  useEffect(() => {
    const fromUrl = readIntakeSubmissionIdFromSearch(location.search);
    if (fromUrl) setIntakeSubmissionId(fromUrl);
  }, [location.search]);

  const intakeFromUrl = !!readIntakeSubmissionIdFromSearch(location.search);
  const pollRegistration =
    !!userId &&
    !!id &&
    !!program?.jotformIntakeFormUrl?.trim() &&
    !intakeSubmissionId &&
    !intakeFromUrl;

  const { data: intakeJotformResume } = useQuery({
    queryKey: ['program', id, 'jotform-resume'],
    queryFn: () => programsApi.getJotformResume(id!),
    enabled: pollRegistration,
  });

  useEffect(() => {
    const sid = searchParams.get('session') || searchParams.get('jotform_session');
    if (!sid?.trim() || !userId || !id || !program?.jotformIntakeFormUrl?.trim()) return;
    let cancelled = false;
    (async () => {
      try {
        await programsApi.putJotformResume(id, sid.trim());
        if (!cancelled) {
          queryClient.invalidateQueries({ queryKey: ['program', id, 'jotform-resume'] });
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
  }, [searchParams, userId, id, program?.jotformIntakeFormUrl, queryClient, setSearchParams]);

  useEffect(() => {
    if (intakeSubmissionId) {
      queryClient.invalidateQueries({ queryKey: ['program', id, 'jotform-resume'] });
    }
  }, [intakeSubmissionId, id, queryClient]);

  const { data: myRegistration } = useQuery({
    queryKey: ['program', id, 'registration'],
    queryFn: () => programsApi.getMyRegistration(id!),
    enabled: pollRegistration,
    refetchInterval: pollRegistration ? 3000 : false,
  });

  useEffect(() => {
    if (myRegistration?.intakeJotformSubmissionId?.trim()) {
      setIntakeSubmissionId(myRegistration.intakeJotformSubmissionId.trim());
    }
  }, [myRegistration?.intakeJotformSubmissionId]);

  const { data: slots = [] } = useQuery({
    queryKey: ['program-slots', id],
    queryFn: () => programsApi.getSlots(id!),
    enabled: !!id && program?.zoomSessionType === 'MEETING',
  });

  const steps = useMemo(
    () => (program ? buildSteps(program, slots.length > 0) : []),
    [program, slots.length],
  );

  const [stepIndex, setStepIndex] = useState(0);
  const [selectedSlotId, setSelectedSlotId] = useState<string | undefined>();

  const submitMut = useMutation({
    mutationFn: () =>
      programsApi.submitRegistration(id!, {
        officeHoursSlotId: selectedSlotId,
        intakeJotformSubmissionId: intakeSubmissionId?.trim(),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['enrollments'] });
      queryClient.invalidateQueries({ queryKey: ['program', id, 'registration'] });
      queryClient.invalidateQueries({ queryKey: ['programs', 'me', 'live-session-status'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'webinar-registrations', 'pending'] });
      navigate(`${backHref}?registered=1`);
    },
  });

  const intakeFormSrc = useMemo(() => {
    if (!program?.jotformIntakeFormUrl?.trim()) return '';
    return buildIntakeFormUrl(program.jotformIntakeFormUrl, {
      returnRedirect: returnUrl || undefined,
      userId: userId || undefined,
      programId: program.id,
      jotformSessionId: intakeJotformResume?.sessionId,
    });
  }, [program, returnUrl, userId, intakeJotformResume?.sessionId]);

  const jotformThankYouRedirectTemplate = useMemo(
    () => (returnUrl ? buildJotformThankYouRedirectTemplate(returnUrl) : ''),
    [returnUrl],
  );

  if (isLoading || !id) return <LoadingSpinner />;

  if (isError || !program) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-gray-50 p-10 text-center">
        <p className="font-semibold text-gray-900">Program not found</p>
        <Link to="/app/webinars" className="mt-4 inline-block text-sm font-semibold text-gray-900 underline">
          Back
        </Link>
      </div>
    );
  }

  const current = steps[stepIndex];
  const isLastStep = stepIndex >= steps.length - 1;

  const goNext = () => {
    if (isLastStep) {
      submitMut.mutate();
      return;
    }
    setStepIndex((i) => Math.min(i + 1, steps.length - 1));
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6 pb-24 md:pb-8">
      <Link
        to={backHref}
        className="inline-flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-gray-900"
      >
        <ChevronLeft className="h-4 w-4" />
        Back to session
      </Link>

      <div className="rounded-2xl border border-gray-200 bg-white p-6 md:p-8 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
          {program.zoomSessionType === 'MEETING' ? 'CHM Office Hours' : 'LIVE'} registration
        </p>
        <h1 className="mt-1 text-2xl font-semibold text-gray-900">{program.title}</h1>
        <p className="mt-2 text-sm text-gray-600">
          Complete intake if this step appears, then pick a time slot when offered. Submit to send your registration for
          review when required. Post-event feedback lives under <strong>Surveys</strong>.
        </p>

        <ol className="mt-6 flex flex-wrap gap-2 text-xs">
          {steps.map((s, i) => (
            <li
              key={`${s}-${i}`}
              className={[
                'rounded-full px-3 py-1 font-semibold',
                i === stepIndex ? 'bg-gray-900 text-white' : i < stepIndex ? 'bg-green-100 text-green-900' : 'bg-gray-100 text-gray-600',
              ].join(' ')}
            >
              {i + 1}.{' '}
              {s === 'intake' ? 'Intake' : s === 'slot' ? 'Pick a time' : 'Submit'}
            </li>
          ))}
        </ol>

        <div className="mt-8 space-y-4">
          {current === 'intake' && program.jotformIntakeFormUrl && (
            <div className="space-y-3">
              <p className="text-sm font-semibold text-gray-900">Your information</p>
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
                . After submit, you should return here with a submission ID in the URL. If the form has{' '}
                <strong>Save &amp; Continue</strong>, partial progress is kept for <strong>24 hours</strong> when you
                return signed in. The server can also record the submission via Jotform webhook (usually within
                seconds). Finish any remaining steps (time slot if offered), then <strong>Submit registration</strong>.
              </p>
              {jotformThankYouRedirectTemplate ? (
                <details className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-700">
                  <summary className="cursor-pointer font-semibold text-gray-900">
                    Host setup: Jotform thank-you redirect (submission ID)
                  </summary>
                  <p className="mt-2 text-gray-600">
                    In Jotform open <strong>Settings → Thank You page → Redirect to an external link</strong> and set the
                    URL to exactly this (Jotform replaces <code className="rounded bg-white px-1">{`{id}`}</code> with the
                    submission id). Also add hidden fields <code className="rounded bg-white px-1">user_id</code> and{' '}
                    <code className="rounded bg-white px-1">program_id</code> on the form so webhooks match the learner;
                    point the form webhook to your app&apos;s Jotform endpoint.
                  </p>
                  <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
                    <code className="block flex-1 break-all rounded border border-gray-200 bg-white px-2 py-1.5 text-[11px] text-gray-900">
                      {jotformThankYouRedirectTemplate}
                    </code>
                    <button
                      type="button"
                      onClick={() => {
                        void navigator.clipboard?.writeText(jotformThankYouRedirectTemplate);
                      }}
                      className="shrink-0 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-900 hover:bg-gray-50"
                    >
                      Copy URL
                    </button>
                  </div>
                </details>
              ) : null}
              {intakeSubmissionId?.trim() ? (
                <p className="text-xs font-medium text-green-800 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                  Intake submission recorded. Use <strong>Continue</strong>, then <strong>Submit registration</strong> to
                  send your request for admin approval.
                </p>
              ) : null}
              <div className="min-h-[420px] w-full overflow-hidden rounded-xl border border-gray-200 bg-gray-50">
                <iframe
                  title="Intake form"
                  src={intakeFormSrc}
                  className="h-[480px] w-full"
                  allow="camera; microphone"
                />
              </div>
            </div>
          )}

          {current === 'slot' && (
            <div className="rounded-xl border border-gray-100 bg-white p-5 md:p-6">
              <OfficeHoursSlotPicker
                slots={slots}
                selectedId={selectedSlotId}
                onSelect={setSelectedSlotId}
                subtitle="The session is split into 15-minute windows (four per hour). Pick one, then continue. After registration, join from this app using the same Zoom meeting link the host shared."
              />
            </div>
          )}

          {current === 'submit' && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950 space-y-2">
              {program.registrationRequiresApproval ? (
                <>
                  <p className="font-semibold text-amber-950">Submit registration for approval</p>
                  <p>
                    Tap <strong>Submit registration</strong> below to send your request to the host. An administrator
                    must approve you before you can join the session or unlock Conversations and surveys for this
                    activity.
                  </p>
                  <p className="text-xs text-amber-900">
                    You are <strong>not</strong> enrolled until approval—expect a pending state on the session page
                    until then.
                  </p>
                </>
              ) : (
                <p>
                  <strong>Almost done:</strong> Submit to complete registration
                  {program.zoomSessionType === 'MEETING' ? ' and reserve your slot' : ''}.
                </p>
              )}
              {!!program.jotformIntakeFormUrl?.trim() && !intakeSubmissionId?.trim() ? (
                <p className="text-xs text-amber-900 bg-amber-100/80 border border-amber-200 rounded-lg px-3 py-2">
                  Intake is optional before you submit. Complete the form when you can so we can keep your answers on
                  file (return from Jotform or wait for the automatic save).
                </p>
              ) : null}
            </div>
          )}

          {submitMut.isError && (
            <p className="text-sm text-red-700">
              {(submitMut.error as { response?: { data?: { message?: string } } })?.response?.data?.message ||
                'Something went wrong. Try again.'}
            </p>
          )}
        </div>

        <div className="mt-8 flex flex-wrap justify-end gap-3">
          {stepIndex > 0 && (
            <button
              type="button"
              onClick={() => setStepIndex((i) => Math.max(0, i - 1))}
              className="rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-800 hover:bg-gray-50"
            >
              Back
            </button>
          )}
          <button
            type="button"
            onClick={goNext}
            disabled={
              submitMut.isPending || (current === 'slot' && slots.length > 0 && !selectedSlotId)
            }
            className="inline-flex items-center gap-2 rounded-lg bg-gray-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-black disabled:opacity-50"
          >
            {submitMut.isPending && isLastStep ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Submitting…
              </>
            ) : isLastStep ? (
              'Submit registration'
            ) : (
              'Continue'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
