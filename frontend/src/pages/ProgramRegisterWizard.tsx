import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useLocation } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { programsApi, type Program } from '../api/programs';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import { ChevronLeft, ExternalLink, Loader2 } from 'lucide-react';
import { format, parseISO } from 'date-fns';

type StepKey = 'intake' | 'pre' | 'bill' | 'slot' | 'submit';

function buildSteps(p: Program, hasSlots: boolean): StepKey[] {
  const steps: StepKey[] = [];
  if (p.jotformIntakeFormUrl?.trim()) steps.push('intake');
  if (p.jotformPreEventUrl?.trim()) steps.push('pre');
  steps.push('bill');
  if (hasSlots) steps.push('slot');
  steps.push('submit');
  return steps;
}

export default function ProgramRegisterWizard() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const isOfficeHours = location.pathname.includes('/office-hours/') || location.pathname.includes('/chm-office-hours/');
  const backHref = isOfficeHours ? `/app/chm-office-hours/${id}` : `/app/live/${id}`;

  const returnUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}${backHref}?registered=1`
      : '';

  const { data: program, isLoading, isError } = useQuery({
    queryKey: ['program', id],
    queryFn: () => programsApi.getById(id!),
    enabled: !!id,
    retry: false,
  });

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
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['enrollments'] });
      queryClient.invalidateQueries({ queryKey: ['program', id, 'registration'] });
      queryClient.invalidateQueries({ queryKey: ['program', id, 'calendly-scheduling'] });
      navigate(`${backHref}?registered=1`);
    },
  });

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

  const jotformAppendReturn = (url: string) => {
    try {
      const u = new URL(url);
      u.searchParams.set('redirect', returnUrl);
      return u.toString();
    } catch {
      return url;
    }
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
          Complete the steps in one place: Jotform (workflow), optional Bill.com vendor setup, then time slot if
          applicable. You can embed these URLs in Jotform thank-you pages to return here:{' '}
          <span className="font-mono text-xs break-all">{returnUrl}</span>
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
              {i + 1}. {s === 'intake' ? 'Intake' : s === 'pre' ? 'Pre-event' : s === 'bill' ? 'Bill.com' : s === 'slot' ? 'Time slot' : 'Submit'}
            </li>
          ))}
        </ol>

        <div className="mt-8 space-y-4">
          {current === 'intake' && program.jotformIntakeFormUrl && (
            <div className="space-y-3">
              <p className="text-sm font-semibold text-gray-900">Your information (Jotform)</p>
              <p className="text-xs text-gray-600">
                Submit the form below. Configure Jotform to redirect to the return URL above to land back in the app
                after submit.
              </p>
              <div className="min-h-[420px] w-full overflow-hidden rounded-xl border border-gray-200 bg-gray-50">
                <iframe
                  title="Intake form"
                  src={jotformAppendReturn(program.jotformIntakeFormUrl)}
                  className="h-[480px] w-full"
                  allow="camera; microphone; payment"
                />
              </div>
            </div>
          )}

          {current === 'pre' && program.jotformPreEventUrl && (
            <div className="space-y-3">
              <p className="text-sm font-semibold text-gray-900">Pre-event survey</p>
              <div className="min-h-[420px] w-full overflow-hidden rounded-xl border border-gray-200 bg-gray-50">
                <iframe
                  title="Pre-event survey"
                  src={jotformAppendReturn(program.jotformPreEventUrl)}
                  className="h-[480px] w-full"
                  allow="camera; microphone; payment"
                />
              </div>
            </div>
          )}

          {current === 'bill' && (
            <div className="space-y-3 rounded-xl border border-gray-200 bg-gray-50 p-5">
              <p className="text-sm font-semibold text-gray-900">Vendor & payments (Bill.com)</p>
              <p className="text-sm text-gray-600">
                If this program requires payment setup, open Bill.com in a new tab, complete onboarding, then return here
                and continue. This keeps Jotform and Bill.com in one guided flow without mixing iframes.
              </p>
              <a
                href="/app/payments"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white transition-[background-color,color,transform] duration-200 ease-[cubic-bezier(0.2,0,0,1)] hover:bg-black active:scale-[0.96]"
              >
                Open Bill.com setup
                <ExternalLink className="h-4 w-4" />
              </a>
            </div>
          )}

          {current === 'slot' && (
            <div className="space-y-3">
              <p className="text-sm font-semibold text-gray-900">Choose a time</p>
              <p className="text-xs text-gray-600">Slots match the scheduled session length set for this program.</p>
              <ul className="space-y-2">
                {slots.map((s) => (
                  <li key={s.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedSlotId(s.id)}
                      disabled={s.remaining <= 0}
                      className={[
                        'w-full rounded-xl border px-4 py-3 text-left text-sm transition-[color,background-color,border-color,transform] duration-200 ease-[cubic-bezier(0.2,0,0,1)] active:scale-[0.995]',
                        selectedSlotId === s.id ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-200 bg-white hover:bg-gray-50',
                        s.remaining <= 0 ? 'opacity-50 cursor-not-allowed' : '',
                      ].join(' ')}
                    >
                      <span className="font-semibold">
                        {format(parseISO(s.startsAt), 'EEE MMM d, h:mm a')} – {format(parseISO(s.endsAt), 'h:mm a')}
                      </span>
                      {s.label ? <span className="ml-2 text-xs opacity-80">{s.label}</span> : null}
                      <span className="mt-1 block text-xs opacity-80">
                        {s.remaining} spot{s.remaining === 1 ? '' : 's'} left
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {current === 'submit' && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
              {program.registrationRequiresApproval ? (
                <p>
                  <strong>Admin review:</strong> Your request will be pending until an administrator approves it. You
                  are not enrolled until then.
                </p>
              ) : (
                <p>
                  <strong>Almost done:</strong> Submit to complete registration
                  {program.zoomSessionType === 'MEETING' ? ' and reserve your slot' : ''}.
                </p>
              )}
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
              submitMut.isPending ||
              (current === 'slot' && slots.length > 0 && !selectedSlotId)
            }
            className="inline-flex items-center gap-2 rounded-lg bg-gray-900 px-5 py-2.5 text-sm font-semibold text-white transition-[background-color,color,transform] duration-200 ease-[cubic-bezier(0.2,0,0,1)] hover:bg-black active:scale-[0.96] disabled:opacity-50"
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
