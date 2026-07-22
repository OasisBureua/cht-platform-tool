import { useMemo, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, ArrowLeft, Save } from 'lucide-react';
import { surveysApi, type Survey } from '../../api/surveys';
import { adminApi } from '../../api/admin';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import { NativeSurveyQuestionEditor } from '../../components/admin/NativeSurveyQuestionEditor';
import {
  normalizeEditableSurveySchema,
  type EditableSurveySchema,
} from '../../utils/native-survey-editor';

export default function AdminEditSurvey() {
  const { id } = useParams<{ id: string }>();

  const {
    data: survey,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['survey', id],
    queryFn: () => surveysApi.getById(id!),
    enabled: Boolean(id),
  });

  if (isLoading) return <LoadingSpinner />;

  if (isError || !survey) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-gray-50 p-10 text-center">
        <p className="font-semibold text-gray-900">Survey not found</p>
        <Link
          to="/admin/surveys"
          className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-gray-900 hover:underline"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to surveys
        </Link>
      </div>
    );
  }

  return <AdminEditSurveyForm key={survey.id} survey={survey} />;
}

function AdminEditSurveyForm({ survey }: { survey: Survey }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [title, setTitle] = useState(survey.title);
  const [description, setDescription] = useState(survey.description ?? '');
  const [required, setRequired] = useState(survey.required);
  const [questions, setQuestions] = useState<EditableSurveySchema>(() =>
    normalizeEditableSurveySchema(survey.questions),
  );
  const [saveError, setSaveError] = useState<string | null>(null);

  const originalQuestionIds = useMemo(() => {
    if (!survey.responseCount) return new Set<string>();
    const schema = normalizeEditableSurveySchema(survey.questions);
    return new Set(
      schema.sections.flatMap((section) =>
        section.questions.map((question) => question.id),
      ),
    );
  }, [survey.questions, survey.responseCount]);

  const updateMutation = useMutation({
    mutationFn: () =>
      adminApi.updateSurvey(survey.id, {
        title: title.trim(),
        description: description.trim(),
        required,
        questions: questions as unknown as Record<string, unknown>,
      }),
    onMutate: () => setSaveError(null),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'surveys'] });
      void queryClient.invalidateQueries({
        queryKey: ['survey', survey.id],
      });
      navigate(
        survey.programId
          ? `/admin/programs/${survey.programId}/hub?tab=surveys`
          : '/admin/surveys',
      );
    },
    onError: (err: unknown) => {
      const ax = err as {
        response?: { data?: { message?: string | string[] } };
      };
      const message = ax.response?.data?.message;
      setSaveError(
        (Array.isArray(message) ? message.join('; ') : message) ||
          (err instanceof Error ? err.message : 'Failed to update survey.'),
      );
    },
  });

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (
      survey.responseCount &&
      !window.confirm(
        `This survey has ${survey.responseCount} response(s). Existing question IDs and answer mappings will be preserved; only new questions and safe settings can be changed. Continue?`,
      )
    ) {
      return;
    }
    updateMutation.mutate();
  };

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <div>
        <Link
          to="/admin/surveys"
          className="inline-flex items-center gap-2 text-sm font-semibold text-gray-700 hover:text-gray-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to surveys
        </Link>
        <h1 className="mt-4 text-2xl font-bold text-gray-900">Edit Survey</h1>
        <p className="mt-1 text-sm text-gray-600">
          Edit the auto-generated{' '}
          {survey.type === 'INTAKE' ? 'registration intake' : 'post-event'}{' '}
          survey. Saving marks it customized, so template regeneration will
          leave it untouched.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-6">
          <label className="block space-y-1">
            <span className="text-sm font-semibold text-gray-900">Title</span>
            <input
              type="text"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm"
              required
            />
          </label>
          <label className="block space-y-1">
            <span className="text-sm font-semibold text-gray-900">
              Description
            </span>
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm"
              rows={3}
            />
          </label>
          <label className="inline-flex items-center gap-2 text-sm font-medium text-gray-800">
            <input
              type="checkbox"
              checked={required}
              onChange={(event) => setRequired(event.target.checked)}
            />
            Survey is required
          </label>
        </div>

        {survey.responseCount ? (
          <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <p className="font-semibold">
                {survey.responseCount} response(s) already use this schema
              </p>
              <p className="mt-1">
                You can add and reorder questions or change required settings.
                Existing prompts, types, options, IDs, and questions are locked
                so CSV and analytics mappings remain valid.
              </p>
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
            No responses have been collected yet. Questions can be fully edited,
            reordered, added, or removed.
          </div>
        )}

        <div className="space-y-4 rounded-2xl border border-gray-200 bg-white p-6">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Questions</h2>
            <p className="mt-1 text-sm text-gray-600">
              Add questions and choose text, choice, rating, or information
              types. Question IDs are generated once and used as response keys.
            </p>
          </div>
          {questions ? (
            <NativeSurveyQuestionEditor
              value={questions}
              onChange={setQuestions}
              lockedQuestionIds={originalQuestionIds}
            />
          ) : null}
        </div>

        {survey.jotformFormId ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            <p className="font-semibold">Legacy Jotform survey</p>
            <p className="mt-1">
              Saving native questions will detach Jotform form{' '}
              <span className="font-mono">{survey.jotformFormId}</span> without
              replacing this survey or deleting responses.
            </p>
          </div>
        ) : null}

        {saveError && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-700 text-sm">
            {saveError}
          </div>
        )}

        <div className="flex flex-wrap gap-4">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="rounded-xl border border-gray-200 bg-white px-6 py-2.5 text-sm font-semibold text-gray-900 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={updateMutation.isPending || !questions}
            className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            {updateMutation.isPending ? 'Saving...' : 'Save customized survey'}
          </button>
        </div>
      </form>
    </div>
  );
}
