import { useParams } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { CheckCircle2 } from 'lucide-react';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import { NativeSurveyForm } from '../../components/surveys/NativeSurveyForm';
import { publicRegistrationApi } from '../../api/publicRegistration';
import { getApiErrorMessage } from '../../api/client';

/** The registration survey behind a personal emailed link (no login). */
export default function PublicRegistrationSurvey() {
  const { token = '' } = useParams<{ token: string }>();

  const { data, isLoading, isError } = useQuery({
    queryKey: ['public-registration-survey', token],
    queryFn: () => publicRegistrationApi.getSurvey(token),
    enabled: !!token,
    retry: false,
  });

  const submit = useMutation({
    mutationFn: (answers: Record<string, unknown>) => publicRegistrationApi.submitSurvey(token, answers),
  });

  if (isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center">
        <h1 className="text-2xl font-bold text-foreground">This link is not valid</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          The link may be incomplete, or registration for this program has closed.
        </p>
      </div>
    );
  }

  const done = submit.isSuccess || !!data.submittedAt;

  return (
    <div className="mx-auto max-w-2xl px-4 py-12 sm:py-16">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-700 dark:text-brand-400">
        Registration survey
      </p>
      <h1 className="mt-2 text-balance text-2xl font-bold tracking-tight text-foreground md:text-3xl">
        {data.program.title}
      </h1>

      {done ? (
        <div className="mt-8 rounded-card border border-border bg-card p-6">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" aria-hidden />
            <div>
              <p className="font-semibold text-foreground">Thank you, {data.registrant.firstName}.</p>
              <p className="mt-1 text-sm text-muted-foreground">Your registration survey has been submitted.</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="mt-8 space-y-4">
          {data.survey.description ? (
            <p className="whitespace-pre-line text-sm text-muted-foreground">{data.survey.description}</p>
          ) : null}
          <NativeSurveyForm
            surveyId={data.survey.id}
            title={data.survey.title}
            questions={data.survey.questions}
            authenticated
            userSummary={{ firstName: data.registrant.firstName }}
            submitting={submit.isPending}
            submitLabel="Submit"
            onSubmit={(answers) => submit.mutate(answers)}
          />
          {submit.isError ? (
            <p className="text-sm font-medium text-destructive">
              {getApiErrorMessage(submit.error, 'Could not submit the survey. Please try again.')}
            </p>
          ) : null}
        </div>
      )}
    </div>
  );
}
