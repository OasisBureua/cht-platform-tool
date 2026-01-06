import { useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import { surveysApi } from '../api/surveys';
import type { Survey, SurveyQuestion } from '../api/surveys';
import { ArrowLeft, ArrowRight, CheckCircle2, ExternalLink, ClipboardList } from 'lucide-react';

const TEMP_USER_ID = '1234567890';

function safeQuestions(questions: any): SurveyQuestion[] {
  if (!questions) return [];
  if (Array.isArray(questions)) return questions as SurveyQuestion[];
  // common pattern: { questions: [...] }
  if (typeof questions === 'object' && Array.isArray((questions as any).questions)) {
    return (questions as any).questions as SurveyQuestion[];
  }
  return [];
}

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

  const [started, setStarted] = useState(false);

  const { data: survey, isLoading, isError } = useQuery({
    queryKey: ['survey', id],
    queryFn: () => surveysApi.getById(id!),
    enabled: Boolean(id),
  });

  const questions = useMemo(() => safeQuestions(survey?.questions), [survey?.questions]);

  const submitMutation = useMutation({
    mutationFn: async () => {
      // UI-only placeholder submission payload (answers empty for now)
      return surveysApi.submitResponse(id!, {
        userId: TEMP_USER_ID,
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
  const jotformEmbedUrl = survey.jotformFormId
    ? `https://form.jotform.com/${survey.jotformFormId}`
    : null;

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
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div className="space-y-1">
                <p className="text-sm font-semibold text-gray-900">Survey experience</p>
                <p className="text-sm text-gray-600">
                  {hasJotform
                    ? 'This survey is powered by Jotform.'
                    : 'This survey will be rendered natively (UI-only for now).'}
                </p>
              </div>

              <div className="flex gap-2">
                {hasJotform && jotformEmbedUrl ? (
                  <a
                    href={jotformEmbedUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center justify-center rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-900 hover:bg-gray-50"
                  >
                    Open in new tab <ExternalLink className="ml-2 h-4 w-4" />
                  </a>
                ) : null}

                <button
                  onClick={() => setStarted(true)}
                  className="inline-flex items-center justify-center rounded-lg bg-gray-900 px-3 py-2 text-sm font-semibold text-white hover:bg-black"
                >
                  Start survey <ArrowRight className="ml-2 h-4 w-4" />
                </button>
              </div>
            </div>

            {started ? (
              <div className="mt-5">
                {hasJotform && jotformEmbedUrl ? (
                  <div className="rounded-2xl overflow-hidden border border-gray-200 bg-black">
                    <iframe
                      src={jotformEmbedUrl}
                      title={survey.title}
                      className="w-full"
                      style={{ height: 720 }}
                      allow="clipboard-write; camera; microphone"
                    />
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

          {/* Questions preview */}
          <div className="rounded-3xl border border-gray-200 bg-white p-6">
            <p className="text-sm font-semibold text-gray-900">Questions preview</p>
            <p className="mt-1 text-sm text-gray-600">
              {questions.length > 0
                ? `Showing ${questions.length} question(s) from the survey schema.`
                : 'No questions found in the schema.'}
            </p>

            {questions.length === 0 ? (
              <div className="mt-5 rounded-2xl border border-gray-200 bg-gray-50 p-8 text-center">
                <ClipboardList className="mx-auto h-10 w-10 text-gray-400" />
                <p className="mt-3 font-semibold text-gray-900">No questions available</p>
                <p className="mt-1 text-sm text-gray-600">
                  Add questions to the survey JSON to populate this section.
                </p>
              </div>
            ) : (
              <div className="mt-5 space-y-3">
                {questions.map((q: any, idx) => (
                  <QuestionCard key={q.id || idx} q={q} index={idx + 1} />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right: meta */}
        <aside className="lg:col-span-4 space-y-4">
          <div className="rounded-3xl border border-gray-200 bg-gray-50 p-6">
            <p className="text-sm font-semibold text-gray-900">Details</p>

            <div className="mt-4 space-y-3 text-sm">
              <Meta label="Type" value={typeLabel(survey.type)} />
              <Meta label="Required" value={survey.required ? 'Yes' : 'No'} />
              <Meta label="Program ID" value={survey.programId} />
              {survey.jotformFormId ? <Meta label="Jotform Form ID" value={survey.jotformFormId} /> : null}
            </div>

            <div className="mt-6 rounded-2xl border border-gray-200 bg-white p-4">
              <p className="text-xs font-semibold text-gray-600">Tip</p>
              <p className="mt-1 text-sm text-gray-700">
                Keep surveys short and focused — completion rates improve dramatically under 3 minutes.
              </p>
            </div>
          </div>

          <div className="rounded-3xl border border-gray-200 bg-gray-900 p-6">
            <p className="text-sm font-semibold text-white">Need to earn rewards?</p>
            <p className="mt-2 text-sm text-gray-300">
              Rewards and tracking are available in the app experience.
            </p>
            <Link
              to="/app/webinars"
              className="mt-5 inline-flex w-full items-center justify-center rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-gray-900 hover:bg-gray-100"
            >
              Go to app
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

function QuestionCard({ q, index }: { q: any; index: number }) {
  const prompt = q.prompt || q.question || q.label || `Question ${index}`;
  const type = q.type || 'unknown';
  const required = q.required ? 'Required' : 'Optional';
  const options = Array.isArray(q.options) ? q.options : [];

  return (
    <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-gray-600">
            Q{index} • {String(type)} • {required}
          </p>
          <p className="mt-1 text-sm font-semibold text-gray-900">{String(prompt)}</p>
        </div>
      </div>

      {options.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {options.slice(0, 8).map((opt: string, i: number) => (
            <span
              key={`${opt}-${i}`}
              className="rounded-full border border-gray-200 bg-white px-3 py-1 text-xs font-semibold text-gray-700"
            >
              {opt}
            </span>
          ))}
          {options.length > 8 ? (
            <span className="text-xs text-gray-500">+{options.length - 8} more</span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
