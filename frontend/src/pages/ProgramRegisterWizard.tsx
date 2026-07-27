import { useMemo, useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useParams, useLocation } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { programsApi, type Program } from '../api/programs';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import { ChevronLeft, Loader2 } from 'lucide-react';
import { OfficeHoursSlotPicker } from '../components/office-hours/OfficeHoursSlotPicker';
import { useAuth } from '../contexts/AuthContext';
import { ProgramSurveyPanel } from '../components/surveys/ProgramSurveyPanel';
import { surveysApi } from '../api/surveys';
import SessionDisclaimerNotice from '../components/programs/SessionDisclaimerNotice';
import { getSessionCoverUrl } from '../utils/session-cover-url';

type StepKey = 'intake' | 'slot' | 'submit';

const REGISTRATION_INTAKE_FORM_ID = 'registration-intake-survey';

type WizardDraft = {
  stepIndex: number;
  selectedSlotId?: string;
  intakeSubmissionId?: string;
};

function draftStorageKey(programId: string) {
  return `cht:register-wizard:${programId}`;
}

function readDraft(programId: string): WizardDraft | null {
  try {
    const raw = sessionStorage.getItem(draftStorageKey(programId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as WizardDraft;
    if (typeof parsed?.stepIndex !== 'number' || parsed.stepIndex < 0) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeDraft(programId: string, draft: WizardDraft) {
  try {
    sessionStorage.setItem(draftStorageKey(programId), JSON.stringify(draft));
  } catch {
    /* ignore quota / private mode */
  }
}

function clearDraft(programId: string) {
  try {
    sessionStorage.removeItem(draftStorageKey(programId));
  } catch {
    /* ignore */
  }
}

function buildSteps(p: Program, hasSlots: boolean): StepKey[] {
  const steps: StepKey[] = [];
  if (p.hasIntakeSurvey || p.intakeSurveyId) {
    steps.push('intake');
  }
  if (hasSlots) steps.push('slot');
  steps.push('submit');
  return steps;
}

export default function ProgramRegisterWizard() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const userId = user?.userId;
  const initialDraft = id ? readDraft(id) : null;
  const [intakeSubmissionId, setIntakeSubmissionId] = useState<string | undefined>(
    initialDraft?.intakeSubmissionId,
  );
  const isOfficeHours =
    location.pathname.includes('/office-hours/') ||
    location.pathname.includes('/chm-office-hours/');
  const backHref = isOfficeHours
    ? `/app/chm-office-hours/${id}`
    : `/app/live/${id}`;

  const { data: program, isLoading, isError } = useQuery({
    queryKey: ['program', id],
    queryFn: () => programsApi.getById(id!),
    enabled: !!id,
    retry: false,
  });

  const { data: myRegistration } = useQuery({
    queryKey: ['program', id, 'registration'],
    queryFn: () => programsApi.getMyRegistration(id!),
    enabled: !!userId && !!id,
    refetchInterval: (q) => (q.state.data?.status === 'PENDING' ? 4000 : false),
  });

  useEffect(() => {
    if (myRegistration?.intakeSubmissionId?.trim()) {
      setIntakeSubmissionId(myRegistration.intakeSubmissionId.trim());
    }
  }, [myRegistration?.intakeSubmissionId]);

  const { data: slots = [] } = useQuery({
    queryKey: ['program-slots', id],
    queryFn: () => programsApi.getSlots(id!),
    enabled: !!id && program?.zoomSessionType === 'MEETING',
  });

  const steps = useMemo(
    () => (program ? buildSteps(program, slots.length > 0) : []),
    [program, slots.length],
  );

  const [stepIndex, setStepIndex] = useState(() => initialDraft?.stepIndex ?? 0);
  const [selectedSlotId, setSelectedSlotId] = useState<string | undefined>(
    initialDraft?.selectedSlotId,
  );
  const [intakeSubmitting, setIntakeSubmitting] = useState(false);
  const [intakeSubmitError, setIntakeSubmitError] = useState<string | null>(null);
  const restoredFromServer = useRef(false);

  const { data: intakeMyResponse } = useQuery({
    queryKey: ['survey', program?.intakeSurveyId, 'my-response'],
    queryFn: () => surveysApi.getMyResponse(program!.intakeSurveyId!),
    enabled: !!userId && !!program?.intakeSurveyId,
  });

  useEffect(() => {
    if (!intakeMyResponse?.submitted) return;
    const sid = intakeMyResponse.submissionId ?? intakeMyResponse.responseId;
    if (sid?.trim()) {
      setIntakeSubmissionId((prev) => prev?.trim() || sid.trim());
    }
  }, [intakeMyResponse]);

  // After intake answers exist but registration is not submitted yet, land on Submit
  // (or keep a further draft step). Never auto-call submitRegistration.
  useEffect(() => {
    if (!id || !program || steps.length === 0 || restoredFromServer.current) return;
    const intakeDone =
      !!intakeSubmissionId?.trim() || !!intakeMyResponse?.submitted;
    const alreadyRegistered = !!myRegistration?.status;
    if (alreadyRegistered) {
      restoredFromServer.current = true;
      return;
    }
    if (!intakeDone) return;

    const submitIdx = steps.indexOf('submit');
    const slotIdx = steps.indexOf('slot');
    const draft = readDraft(id);
    if (draft && draft.stepIndex > 0 && draft.stepIndex < steps.length) {
      setStepIndex(draft.stepIndex);
    } else if (slotIdx >= 0 && !selectedSlotId) {
      setStepIndex(slotIdx);
    } else if (submitIdx >= 0) {
      setStepIndex(submitIdx);
    }
    restoredFromServer.current = true;
  }, [
    id,
    program,
    steps,
    intakeSubmissionId,
    intakeMyResponse?.submitted,
    myRegistration?.status,
    selectedSlotId,
  ]);

  useEffect(() => {
    if (!id || steps.length === 0) return;
    writeDraft(id, {
      stepIndex: Math.min(stepIndex, steps.length - 1),
      selectedSlotId,
      intakeSubmissionId: intakeSubmissionId?.trim() || undefined,
    });
  }, [id, stepIndex, selectedSlotId, intakeSubmissionId, steps.length]);

  const currentStepKey = steps[stepIndex];

  useEffect(() => {
    if (currentStepKey !== 'intake') {
      setIntakeSubmitting(false);
    }
  }, [currentStepKey]);

  const submitMut = useMutation({
    mutationFn: () =>
      programsApi.submitRegistration(id!, {
        officeHoursSlotId: selectedSlotId,
        intakeSubmissionId: intakeSubmissionId?.trim(),
      }),
    onSuccess: () => {
      if (id) clearDraft(id);
      queryClient.invalidateQueries({ queryKey: ['enrollments'] });
      queryClient.invalidateQueries({ queryKey: ['program', id, 'registration'] });
      queryClient.invalidateQueries({
        queryKey: ['programs', 'me', 'live-session-status'],
      });
      queryClient.invalidateQueries({
        queryKey: ['admin', 'webinar-registrations', 'pending'],
      });
      navigate(`${backHref}?registered=1`);
    },
  });

  if (isLoading || !id) return <LoadingSpinner />;

  if (isError || !program) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-gray-50 p-10 text-center">
        <p className="font-semibold text-gray-900">Session not found</p>
        <Link
          to="/app/live"
          className="mt-4 inline-block text-sm font-semibold text-gray-900 underline"
        >
          Back to sessions
        </Link>
      </div>
    );
  }

  const current = steps[stepIndex] ?? 'submit';
  const isLastStep = stepIndex >= steps.length - 1;
  const intakeRecorded =
    !!intakeSubmissionId?.trim() || !!intakeMyResponse?.submitted;
  const alreadyRegistered =
    myRegistration?.status === 'PENDING' ||
    myRegistration?.status === 'APPROVED';

  const goNext = () => {
    if (current === 'intake') {
      setIntakeSubmitError(null);
      if (intakeRecorded) {
        setStepIndex((i) => Math.min(i + 1, steps.length - 1));
        return;
      }
      const form = document.getElementById(
        REGISTRATION_INTAKE_FORM_ID,
      ) as HTMLFormElement | null;
      if (form) {
        if (!form.reportValidity()) {
          setIntakeSubmitError(
            'Complete the required intake fields before continuing.',
          );
          return;
        }
        form.dataset.chtExplicitSubmit = '1';
        form.requestSubmit();
        return;
      }
      setStepIndex((i) => Math.min(i + 1, steps.length - 1));
      return;
    }

    if (isLastStep) {
      if (alreadyRegistered) {
        navigate(`${backHref}?registered=1`);
        return;
      }
      submitMut.mutate();
      return;
    }
    setStepIndex((i) => Math.min(i + 1, steps.length - 1));
  };

  const sessionCoverUrl = getSessionCoverUrl(program);

  return (
    <div className="mx-auto max-w-3xl space-y-6 pb-24 md:pb-8">
      <Link
        to={backHref}
        className="inline-flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-gray-900"
      >
        <ChevronLeft className="h-4 w-4" />
        Back to session
      </Link>

      <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        {sessionCoverUrl ? (
          <div className="border-b border-gray-100 bg-gray-50">
            <img
              src={sessionCoverUrl}
              alt={program.title ? `Cover for ${program.title}` : 'Session cover'}
              className="w-full max-h-52 object-cover"
            />
          </div>
        ) : null}
        <div className="p-6 md:p-8 space-y-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            {program.zoomSessionType === 'MEETING'
              ? 'Office hours'
              : 'Live webinar'}{' '}
            registration
          </p>
          <h1 className="text-2xl font-semibold text-gray-900">
            {program.title}
          </h1>

          {program.sessionDisclaimer?.trim() ? (
            <SessionDisclaimerNotice text={program.sessionDisclaimer.trim()} />
          ) : null}

          <ol className="flex flex-wrap gap-2 text-xs">
            {steps.map((s, i) => (
              <li
                key={`${s}-${i}`}
                className={[
                  'rounded-full px-3 py-1 font-semibold',
                  i === stepIndex
                    ? 'bg-brand-600 text-white'
                    : i < stepIndex
                      ? 'bg-green-100 text-green-900'
                      : 'bg-gray-100 text-gray-600',
                ].join(' ')}
              >
                {i + 1}.{' '}
                {s === 'intake' ? 'Intake' : s === 'slot' ? 'Pick a time' : 'Submit'}
              </li>
            ))}
          </ol>

          <div className="space-y-4">
            {alreadyRegistered ? (
              <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-950 space-y-1">
                <p className="font-semibold">Registration already submitted</p>
                <p>
                  {myRegistration?.status === 'PENDING'
                    ? 'Your request is pending administrator review.'
                    : 'You are registered for this session.'}
                </p>
              </div>
            ) : null}

            {current === 'intake' && program.intakeSurveyId ? (
              <div className="space-y-3">
                <p className="text-sm font-semibold text-gray-900">
                  Your information
                </p>
                <ProgramSurveyPanel
                  surveyId={program.intakeSurveyId}
                  userId={userId ?? ''}
                  programId={program.id}
                  authenticated={!!userId}
                  userSummary={{
                    firstName: user?.firstName,
                    lastName: user?.lastName,
                    email: user?.email,
                  }}
                  hideSubmitButton
                  formId={REGISTRATION_INTAKE_FORM_ID}
                  onSubmittingChange={setIntakeSubmitting}
                  onSubmitError={() => {
                    setIntakeSubmitting(false);
                    setIntakeSubmitError(
                      'Could not save intake. Check your connection and try again.',
                    );
                  }}
                  onSubmitted={(submissionId) => {
                    setIntakeSubmitting(false);
                    setIntakeSubmitError(null);
                    setIntakeSubmissionId(submissionId);
                    // Advance to the next wizard step only — do not register yet.
                    setStepIndex((i) => Math.min(i + 1, steps.length - 1));
                  }}
                />
                {intakeSubmitError ? (
                  <p className="text-sm text-red-700">{intakeSubmitError}</p>
                ) : null}
                {intakeRecorded ? (
                  <p className="text-xs font-medium text-green-800 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                    Your answers are saved. Continue when you are ready — registration
                    is not submitted until the last step.
                  </p>
                ) : null}
              </div>
            ) : null}

            {current === 'intake' && !program.intakeSurveyId ? (
              <p className="text-sm text-gray-600">
                No native intake survey is configured for this session yet.
              </p>
            ) : null}

            {current === 'slot' && (
              <div className="rounded-xl border border-gray-100 bg-white p-5 md:p-6">
                <OfficeHoursSlotPicker
                  slots={slots}
                  selectedId={selectedSlotId}
                  onSelect={setSelectedSlotId}
                  subtitle="The session is split into 10-minute windows (six per hour). Pick one, then continue. After registration, join from this app using the same Zoom meeting link the host shared."
                />
              </div>
            )}

            {current === 'submit' && !alreadyRegistered && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950 space-y-2">
                {program.registrationRequiresApproval ? (
                  <>
                    <p className="font-semibold text-amber-950">
                      Ready to submit
                    </p>
                    <p>
                      Your request goes to an administrator for review. Until it
                      is approved, your registration shows as pending and you
                      cannot join the session.
                    </p>
                  </>
                ) : (
                  <p>
                    Submitting completes your registration
                    {program.zoomSessionType === 'MEETING'
                      ? ' and reserves your time slot'
                      : ''}
                    .
                  </p>
                )}
                {program.intakeSurveyId && !intakeSubmissionId?.trim() ? (
                  <p className="text-xs text-amber-900 bg-amber-100/80 border border-amber-200 rounded-lg px-3 py-2">
                    You have not finished the intake form. You can submit now
                    and complete it later from this page.
                  </p>
                ) : null}
              </div>
            )}

            {submitMut.isError && (
              <p className="text-sm text-red-700">
                {(
                  submitMut.error as {
                    response?: { data?: { message?: string } };
                  }
                )?.response?.data?.message || 'Something went wrong. Try again.'}
              </p>
            )}
          </div>

          <div className="mt-8 flex flex-wrap justify-end gap-3">
            <button
              type="button"
              onClick={goNext}
              disabled={
                submitMut.isPending ||
                (current === 'intake' && intakeSubmitting) ||
                (current === 'slot' && slots.length > 0 && !selectedSlotId)
              }
              className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white transition-[background-color,color,transform] duration-200 ease-[cubic-bezier(0.2,0,0,1)] hover:bg-brand-700 active:scale-[0.96] disabled:opacity-50"
            >
              {submitMut.isPending && isLastStep ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Submitting…
                </>
              ) : intakeSubmitting && current === 'intake' ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving…
                </>
              ) : alreadyRegistered && isLastStep ? (
                'Back to session'
              ) : isLastStep ? (
                'Submit registration'
              ) : (
                'Continue'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
