import { useMemo, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Info, Lock, Save, ShieldCheck } from 'lucide-react';
import { surveysApi, type Survey } from '../../api/surveys';
import { adminApi } from '../../api/admin';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import { SURVEY_TYPE_OPTIONS, surveyTypeLabel, type SurveyTypeValue } from '../../utils/survey-types';
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
      <div className="rounded-card border border-border bg-muted p-10 text-center">
        <p className="font-semibold text-foreground">Survey not found</p>
        <Link
          to="/admin/surveys"
          className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-foreground hover:underline"
        >
          Back to surveys
        </Link>
      </div>
    );
  }

  return <AdminEditSurveyForm key={survey.id} survey={survey} />;
}

function HistorySafeCallout({
  responseCount,
  schemaVersion,
}: {
  responseCount: number;
  schemaVersion?: number;
}) {
  return (
    <div className="flex items-start gap-3 rounded-card border border-brand-100 bg-brand-50/70 p-4 text-sm text-brand-950 shadow-card dark:border-brand-900/40 dark:bg-brand-950/30 dark:text-brand-50">
      <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-brand-700 dark:text-brand-300" aria-hidden />
      <div>
        <p className="font-semibold">
          {responseCount.toLocaleString()} response
          {responseCount === 1 ? '' : 's'} already on schema v{schemaVersion ?? 1}
        </p>
        <p className="mt-1 text-brand-900/90 dark:text-brand-100/90">
          Existing answers stay linked. You can add questions, reorder, and tweak required flags.
          Prompts, types, options, and IDs for answered questions stay locked so CSV and analytics keep
          working.
        </p>
      </div>
    </div>
  );
}

function EditableCallout() {
  return (
    <div className="flex items-start gap-3 rounded-card border border-cyan-100 bg-cyan-50/80 p-4 text-sm text-cyan-950 shadow-card dark:border-cyan-900/40 dark:bg-cyan-950/25 dark:text-cyan-50">
      <Info className="mt-0.5 h-5 w-5 shrink-0 text-cyan-700 dark:text-cyan-300" aria-hidden />
      <div>
        <p className="font-semibold">No responses yet — full edit is open</p>
        <p className="mt-1 text-cyan-900/90 dark:text-cyan-100/90">
          Change, reorder, add, or remove questions freely. Once someone submits, answered questions
          lock to protect response history.
        </p>
      </div>
    </div>
  );
}

export function AdminEditSurveyForm({
  survey,
  embedded = false,
  sections = 'all',
}: {
  survey: Survey;
  /** When true, omit page chrome and stay in the survey studio after save. */
  embedded?: boolean;
  /** Studio tabs can show questions-only or settings-only. */
  sections?: 'all' | 'questions' | 'settings';
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [title, setTitle] = useState(survey.title);
  const [description, setDescription] = useState(survey.description ?? '');
  const [required, setRequired] = useState(survey.required);
  const [surveyType, setSurveyType] = useState<SurveyTypeValue>(survey.type as SurveyTypeValue);
  // The type is fixed once anyone has answered (the API enforces it too).
  const typeLocked = Boolean(survey.responseCount);
  const [questions, setQuestions] = useState<EditableSurveySchema>(() =>
    normalizeEditableSurveySchema(survey.questions),
  );
  const [saveError, setSaveError] = useState<string | null>(null);
  const showSettings = sections === 'all' || sections === 'settings';
  const showQuestions = sections === 'all' || sections === 'questions';

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
        ...(surveyType !== survey.type ? { type: surveyType } : {}),
        questions: questions as unknown as Record<string, unknown>,
      }),
    onMutate: () => setSaveError(null),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'surveys'] });
      void queryClient.invalidateQueries({
        queryKey: ['survey', survey.id],
      });
      if (embedded) {
        void queryClient.invalidateQueries({
          queryKey: ['admin', 'surveys', 'workspace-stats'],
        });
        return;
      }
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
    if (survey.responseCount) {
      const confirmed = window.confirm(
        [
          `Save changes to a survey that already has ${survey.responseCount.toLocaleString()} response(s) (schema v${survey.schemaVersion ?? 1})?`,
          '',
          'Existing answers stay intact. Locked question IDs, prompts, types, and options are not rewritten.',
          'New questions and safe settings updates are allowed. Continue?',
        ].join('\n'),
      );
      if (!confirmed) return;
    }
    updateMutation.mutate();
  };

  return (
    <div className={embedded ? 'space-y-6' : 'mx-auto max-w-5xl space-y-8'}>
      {!embedded ? (
        <div>
          <Link
            to="/admin/surveys"
            className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground"
          >
            Back to surveys
          </Link>
          <h1 className="mt-4 text-2xl font-bold text-foreground">Edit Survey</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Edit this {surveyTypeLabel(survey.type).toLowerCase()}. Saving marks it customized, so
            template regeneration will leave it untouched.
            {typeof survey.schemaVersion === 'number' ? (
              <>
                {' '}
                Current schema version: <strong>v{survey.schemaVersion}</strong>
                {survey.responseCount
                  ? '; saving question changes bumps the version; new responses are stamped with it.'
                  : null}
              </>
            ) : null}
          </p>
        </div>
      ) : showSettings && !showQuestions ? (
        <div className="space-y-1">
          <h2 className="text-base font-semibold text-foreground">Settings</h2>
          <p className="text-sm text-muted-foreground">
            Title, type, description, and required flag. Saving marks this survey customized so
            program-hub &ldquo;Ensure native surveys&rdquo; will not overwrite it.
          </p>
        </div>
      ) : showQuestions && !showSettings ? (
        <div className="space-y-1">
          <h2 className="text-base font-semibold text-foreground">Questions</h2>
          <p className="text-sm text-muted-foreground">
            History-safe editor — answered questions keep their IDs so past responses, CSV columns,
            and analytics stay aligned.
          </p>
        </div>
      ) : null}

      <form onSubmit={handleSubmit} className="space-y-6">
        {showSettings ? (
          <div className="space-y-6 rounded-card border border-border bg-card p-6 shadow-card">
            {typeLocked ? (
              <div className="flex items-start gap-3 rounded-[6px] border border-border bg-muted/40 px-3 py-2.5 text-sm text-muted-foreground">
                <Lock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                <p>
                  Survey type is locked because responses already exist. Other settings below remain
                  editable.
                </p>
              </div>
            ) : null}
            <label className="block space-y-1">
              <span className="text-sm font-semibold text-foreground">Title</span>
              <input
                type="text"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                className="w-full rounded-[6px] border border-border px-4 py-3 text-sm"
                required
              />
            </label>
            <label className="block space-y-1">
              <span className="text-sm font-semibold text-foreground">Survey type</span>
              <select
                value={surveyType}
                onChange={(event) => setSurveyType(event.target.value as SurveyTypeValue)}
                disabled={typeLocked}
                className="w-full rounded-[6px] border border-border px-4 py-3 text-sm disabled:opacity-60"
              >
                {SURVEY_TYPE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
              <span className="block text-xs text-muted-foreground">
                {typeLocked
                  ? 'Locked to protect how responses are grouped in reports.'
                  : SURVEY_TYPE_OPTIONS.find((o) => o.value === surveyType)?.help}
              </span>
            </label>
            <label className="block space-y-1">
              <span className="text-sm font-semibold text-foreground">Description</span>
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                className="w-full rounded-[6px] border border-border px-4 py-3 text-sm"
                rows={3}
              />
            </label>
            <label className="inline-flex items-center gap-2 text-sm font-medium text-foreground">
              <input
                type="checkbox"
                checked={required}
                onChange={(event) => setRequired(event.target.checked)}
              />
              Survey is required
            </label>
          </div>
        ) : null}

        {showQuestions ? (
          <>
            {survey.responseCount ? (
              <HistorySafeCallout
                responseCount={survey.responseCount}
                schemaVersion={survey.schemaVersion}
              />
            ) : (
              <EditableCallout />
            )}

            <div className="space-y-4 rounded-card border border-border bg-card p-6 shadow-card">
              <div>
                <h2 className="text-lg font-semibold text-foreground">Question builder</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Add text, choice, rating, or information blocks. Question IDs are generated once and
                  used as response keys.
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
          </>
        ) : null}

        {survey.jotformFormId && showQuestions ? (
          <div className="flex items-start gap-3 rounded-card border border-amber-200/80 bg-amber-50/80 p-4 text-sm text-amber-950 dark:border-amber-900/40 dark:bg-amber-950/25 dark:text-amber-50">
            <Info className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" aria-hidden />
            <div>
              <p className="font-semibold">Legacy Jotform survey</p>
              <p className="mt-1">
                Saving native questions will detach Jotform form{' '}
                <span className="font-mono">{survey.jotformFormId}</span> without deleting this survey
                or its responses.
              </p>
            </div>
          </div>
        ) : null}

        {saveError ? (
          <div className="rounded-card border border-destructive/25 bg-destructive/10 p-4 text-sm text-destructive">
            {saveError}
          </div>
        ) : null}

        {updateMutation.isSuccess && embedded && !saveError ? (
          <div className="flex items-center gap-2 rounded-card border border-success/25 bg-success/10 px-4 py-3 text-sm font-medium text-success">
            <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden />
            Saved. Response history is unchanged; this survey stays customized against template
            ensure.
          </div>
        ) : null}

        <div className="flex flex-wrap gap-3">
          {!embedded ? (
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="rounded-[6px] border border-border bg-card px-6 py-2.5 text-sm font-semibold text-foreground hover:bg-muted"
            >
              Cancel
            </button>
          ) : null}
          <button
            type="submit"
            disabled={updateMutation.isPending || (showQuestions && !questions)}
            className="inline-flex items-center gap-2 rounded-[6px] bg-brand-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            {updateMutation.isPending
              ? 'Saving…'
              : updateMutation.isSuccess && embedded
                ? 'Saved'
                : 'Save customized survey'}
          </button>
        </div>
      </form>
    </div>
  );
}
