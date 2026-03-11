import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import { useAuth } from '../contexts/AuthContext';
import { surveysApi } from '../api/surveys';
import type { Survey } from '../api/surveys';
import { ArrowLeft, ArrowRight, CheckCircle2 } from 'lucide-react';

function typeLabel(type?: Survey['type']) {
  if (!type) return 'Survey';
  if (type === 'PRE_TEST') return 'Pre-test';
  if (type === 'POST_TEST') return 'Post-test';
  if (type === 'FEEDBACK') return 'Feedback';
  return 'Survey';
}

export default function SurveyDetail() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const userId = user?.userId ?? '';

  const [started, setStarted] = useState(false);

  const { data: survey, isLoading, isError } = useQuery({
    queryKey: ['survey', id],
    queryFn: () => surveysApi.getById(id!),
    enabled: Boolean(id),
  });

  const submitMutation = useMutation({
    mutationFn: async () => {
      // UI-only placeholder submission payload (answers empty for now)
      return surveysApi.submitResponse(id!, {
        userId,
        answers: {},
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['surveys'] });
    },
  });

  if (isLoading) return <LoadingSpinner />;

  if (isError || !survey) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-gray-50 p-10 text-center">
        <p className="font-semibold text-gray-900">Survey not found</p>
        <p className="mt-1 text-sm text-gray-600">Return to surveys and try again.</p>
        <div className="mt-5">
          <Link
            to="/app/surveys"
            className="inline-flex items-center justify-center rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-black"
          >
            Back to surveys
          </Link>
        </div>
      </div>
    );
  }

  const hasJotform = Boolean(survey.jotformFormId);
  const jotformFormUrl = survey.jotformFormUrl ?? (survey.jotformFormId ? `https://communityhealthmedia.jotform.com/${survey.jotformFormId}` : null);
  // Use enterprise URL for embed - form.jotform.com may block embedding from localhost
  const jotformEmbedUrl = jotformFormUrl;

  return (
    <div className="space-y-8">
      {/* Top row */}
      <div className="flex items-center justify-between gap-3">
        <Link to="/app/surveys" className="text-sm font-semibold text-gray-700 hover:text-gray-900">
          <span className="inline-flex items-center gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back to surveys
          </span>
        </Link>

        <span className="text-xs font-semibold text-gray-600 rounded-full border border-gray-200 bg-white px-3 py-1">
          {typeLabel(survey.type)} • {survey.required ? 'Required' : 'Optional'}
        </span>
      </div>

      {/* Header */}
      <header className="space-y-2">
        <h1 className="text-2xl md:text-3xl font-semibold text-gray-900">{survey.title}</h1>
        <p className="text-sm text-gray-600 max-w-3xl">
          {survey.description || 'Complete this survey to contribute your perspective.'}
        </p>
      </header>

      {/* Main */}
      <section className="grid gap-6 lg:grid-cols-12">
        {/* Left: content */}
        <div className="lg:col-span-8 space-y-6">
          {/* Start / Embed */}
          <div className="rounded-3xl border border-gray-200 bg-white p-6">
            {!started ? (
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm font-semibold text-gray-900">Ready to complete the survey?</p>
                <button
                  onClick={() => setStarted(true)}
                  className="inline-flex w-fit items-center justify-center rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-black"
                >
                  Start survey <ArrowRight className="ml-2 h-4 w-4" />
                </button>
              </div>
            ) : null}

            {started ? (
              <div>
                {hasJotform && jotformEmbedUrl ? (
                  <div className="space-y-4">
                    <div className="rounded-2xl overflow-hidden border border-gray-200 bg-white">
                      <iframe
                        src={jotformEmbedUrl}
                        title={survey.title}
                        className="w-full border-0"
                        style={{ height: 720, minHeight: 720 }}
                        allow="clipboard-write; camera; microphone"
                      />
                    </div>
                    {jotformFormUrl ? (
                      <p className="text-sm text-gray-600">
                        If the survey doesn&apos;t load above (e.g. on localhost),{' '}
                        <a
                          href={jotformFormUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="font-semibold text-gray-900 underline hover:text-gray-700"
                        >
                          open the survey in a new tab
                        </a>
                        .
                      </p>
                    ) : null}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-gray-200 bg-gray-50 p-6">
                    <p className="font-semibold text-gray-900">Native survey renderer (placeholder)</p>
                    <p className="mt-1 text-sm text-gray-600">
                      We’ll render questions natively once the question format is finalized.
                      For now, you can preview the questions below.
                    </p>

                    <div className="mt-5">
                      <button
                        onClick={() => submitMutation.mutate()}
                        disabled={submitMutation.isPending}
                        className={[
                          'inline-flex items-center justify-center rounded-lg px-4 py-2.5 text-sm font-semibold',
                          submitMutation.isPending
                            ? 'bg-gray-200 text-gray-600 cursor-not-allowed'
                            : 'bg-gray-900 text-white hover:bg-black',
                        ].join(' ')}
                      >
                        {submitMutation.isPending ? 'Submitting…' : 'Mark as completed (UI)'}
                        <CheckCircle2 className="ml-2 h-4 w-4" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : null}
          </div>

        </div>

        {/* Right: meta */}
        <aside className="lg:col-span-4 space-y-4">
          <div className="rounded-3xl border border-gray-200 bg-gray-50 p-6">
            <p className="text-sm font-semibold text-gray-900">Details</p>

            <div className="mt-4 space-y-3 text-sm">
              <Meta label="Type" value={typeLabel(survey.type)} />
              <Meta label="Required" value={survey.required ? 'Yes' : 'No'} />
              <Meta label="Program" value={survey.program?.title ?? survey.programId} />
            </div>

          </div>

          <div className="rounded-3xl border border-gray-200 bg-gray-900 p-6">
            <p className="text-sm font-semibold text-white">Need to earn rewards?</p>
            <p className="mt-2 text-sm text-gray-300">
              Rewards and tracking are available in the app experience.
            </p>
            <Link
              to="/app/home"
              className="mt-5 inline-flex w-full items-center justify-center rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-gray-900 hover:bg-gray-100"
            >
              Go home
            </Link>
          </div>
        </aside>
      </section>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-gray-600">{label}</span>
      <span className="font-semibold text-gray-900 text-right break-all">{value}</span>
    </div>
  );
}

