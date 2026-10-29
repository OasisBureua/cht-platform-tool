import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { SurveyQuestion } from '../../api/surveys';
import {
  isIdentitySurveyQuestion,
  listNativeSurveySections,
  surveyHasNativeQuestions,
} from '../../utils/survey-questions';
import { surveyFieldInputHints } from '../../utils/survey-field-autocomplete';

type Props = {
  surveyId: string;
  title: string;
  questions: unknown;
  /** When true, name/email fields are omitted (identity from session). */
  authenticated: boolean;
  userSummary?: { firstName?: string; lastName?: string; email?: string };
  disabled?: boolean;
  submitting?: boolean;
  submitLabel?: string;
  /** Hide the submit button (parent handles submission). */
  hideSubmitButton?: boolean;
  /** Lets a parent trigger HTML5 validation + submit (e.g. wizard Continue). */
  formId?: string;
  onSubmit: (answers: Record<string, unknown>) => void;
  w9ProfileHref?: string;
  /** When true, show W-9 / honorarium payout reminder (post-event surveys only). */
  showPayoutNotice?: boolean;
  /**
   * SCRUM-186: pre-fill values keyed by question id for questions that opt
   * into User-profile sync via `syncToProfile`. Applied once on mount; the
   * user can overwrite values before submit.
   */
  profilePrefill?: Record<string, string>;
  /** Server-side draft answers (wins over empty session draft fields). */
  initialAnswers?: Record<string, unknown>;
};

function draftAnswersKey(surveyId: string) {
  return `cht:survey-draft:${surveyId}`;
}

function readDraftAnswers(surveyId: string): Record<string, unknown> {
  try {
    const raw = sessionStorage.getItem(draftAnswersKey(surveyId));
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeDraftAnswers(surveyId: string, answers: Record<string, unknown>) {
  try {
    sessionStorage.setItem(draftAnswersKey(surveyId), JSON.stringify(answers));
  } catch {
    /* ignore */
  }
}

function clearDraftAnswers(surveyId: string) {
  try {
    sessionStorage.removeItem(draftAnswersKey(surveyId));
  } catch {
    /* ignore */
  }
}

export function NativeSurveyForm({
  surveyId,
  title,
  questions,
  authenticated,
  userSummary,
  disabled,
  submitting,
  submitLabel,
  hideSubmitButton,
  formId,
  onSubmit,
  w9ProfileHref = '/app/profile',
  showPayoutNotice = false,
  profilePrefill,
  initialAnswers,
}: Props) {
  const visibleSections = useMemo(() => {
    const sections = listNativeSurveySections(questions).map((section) => ({
      ...section,
      questions: authenticated
        ? section.questions.filter((q) => !isIdentitySurveyQuestion(q))
        : section.questions,
    }));
    return sections.filter((section) => section.questions.length > 0);
  }, [questions, authenticated]);

  /** Progress excludes intro-only info sections from the "x of 5" content count when possible. */
  const progressSections = useMemo(() => {
    const content = visibleSections.filter(
      (s) => s.id !== 'intro' && s.questions.some((q) => q.type !== 'info'),
    );
    return content.length > 0 ? content : visibleSections;
  }, [visibleSections]);

  const [activeSectionIndex, setActiveSectionIndex] = useState(0);

  const [answers, setAnswers] = useState<Record<string, unknown>>(() => ({
    ...(initialAnswers ?? {}),
    ...readDraftAnswers(surveyId),
  }));

  // SCRUM-186: merge profile pre-fill into answers once, only for fields the
  // user hasn't already touched (draft or manual override wins). Runs when
  // profilePrefill arrives (async fetch in parent), keyed on surveyId so a
  // different survey re-applies.
  useEffect(() => {
    if (!profilePrefill) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- merge async profile prefill into untouched answers
    setAnswers((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const [qid, value] of Object.entries(profilePrefill)) {
        const existing = next[qid];
        if (existing === undefined || existing === null || existing === '') {
          next[qid] = value;
          changed = true;
        }
      }
      return changed ? next : prev;
    });
    // Intentionally exclude `answers` from deps: this must only run when the
    // prefill data itself changes, not on every keystroke.
  }, [surveyId, profilePrefill]);

  useEffect(() => {
    writeDraftAnswers(surveyId, answers);
  }, [surveyId, answers]);

  if (!surveyHasNativeQuestions(questions)) {
    return (
      <p className="text-sm text-muted-foreground">
        This survey is not available as a native form yet. Contact support if you need assistance.
      </p>
    );
  }

  const setAnswer = (id: string, value: unknown) => {
    setAnswers((prev) => ({ ...prev, [id]: value }));
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    // Parent-owned submit (hideSubmitButton): ignore Enter / implicit submits.
    // Explicit Complete survey / Continue must set data-cht-explicit-submit="1" first.
    if (hideSubmitButton) {
      const form = e.currentTarget;
      if (form.dataset.chtExplicitSubmit !== '1') {
        return;
      }
      form.dataset.chtExplicitSubmit = '';
    }
    clearDraftAnswers(surveyId);
    onSubmit(answers);
  };

  const blockImplicitEnterSubmit = (e: React.KeyboardEvent<HTMLFormElement>) => {
    if (!hideSubmitButton) return;
    if (e.key !== 'Enter') return;
    const tag = (e.target as HTMLElement | null)?.tagName;
    if (tag === 'TEXTAREA' || tag === 'BUTTON') return;
    e.preventDefault();
  };

  const useSectionWizard = progressSections.length > 1;
  const safeSectionIndex = Math.min(
    activeSectionIndex,
    Math.max(progressSections.length - 1, 0),
  );
  const currentProgressSection = progressSections[safeSectionIndex];
  const isLastProgressSection =
    !useSectionWizard || safeSectionIndex >= progressSections.length - 1;

  // Intro info blocks always shown above the active content section.
  const introSections = visibleSections.filter((s) => s.id === 'intro');

  return (
    <form
      id={formId}
      onSubmit={handleSubmit}
      onKeyDown={blockImplicitEnterSubmit}
      className="space-y-5"
      data-survey-id={surveyId}
    >
      {authenticated && userSummary ? (
        <div className="rounded-card border border-border bg-muted px-4 py-3 text-sm text-muted-foreground">
          Submitting as{' '}
          <strong>
            {[userSummary.firstName, userSummary.lastName].filter(Boolean).join(' ') || 'your account'}
          </strong>
          {userSummary.email ? (
            <>
              {' '}
              (<span className="break-all">{userSummary.email}</span>)
            </>
          ) : null}
        </div>
      ) : null}

      {useSectionWizard && currentProgressSection ? (
        <div
          className="sticky top-0 z-10 -mx-1 rounded-[6px] border border-border bg-card/95 px-3 py-2 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-card/80"
          aria-live="polite"
        >
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Section {safeSectionIndex + 1} of {progressSections.length}
          </p>
          <p className="text-sm font-semibold text-foreground">
            {currentProgressSection.title}
          </p>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-brand-600 transition-[width] duration-200"
              style={{
                width: `${((safeSectionIndex + 1) / progressSections.length) * 100}%`,
              }}
            />
          </div>
        </div>
      ) : null}

      {introSections.map((section) => (
        <div key={section.id} className="space-y-4">
          {section.questions.map((q, idx) => (
            <SurveyQuestionBlock
              key={q.id ?? `intro-${idx}`}
              question={q}
              answers={answers}
              setAnswer={setAnswer}
              disabled={disabled}
            />
          ))}
        </div>
      ))}

      {useSectionWizard && currentProgressSection
        ? currentProgressSection.questions.map((q, idx) => (
            <SurveyQuestionBlock
              key={q.id ?? `q-${idx}`}
              question={q}
              answers={answers}
              setAnswer={setAnswer}
              disabled={disabled}
            />
          ))
        : visibleSections
            .filter((s) => s.id !== 'intro')
            .map((section, sectionIndex, arr) => (
              <section key={section.id} className="space-y-4">
                <header className="border-b border-border pb-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Section {sectionIndex + 1} of {arr.length}
                  </p>
                  <h3 className="text-base font-semibold text-foreground">
                    {section.title}
                  </h3>
                </header>
                {section.questions.map((q, idx) => (
                  <SurveyQuestionBlock
                    key={q.id ?? `q-${idx}`}
                    question={q}
                    answers={answers}
                    setAnswer={setAnswer}
                    disabled={disabled}
                  />
                ))}
              </section>
            ))}

      {showPayoutNotice && isLastProgressSection ? (
        <div className="rounded-card border border-warning/25 bg-warning/10 px-4 py-3 text-xs text-amber-950">
          W-9 and honorarium payout details are managed in your{' '}
          <Link to={w9ProfileHref} className="font-semibold underline">
            profile &amp; payments
          </Link>
          . Complete those after you submit this survey if you have not already.
        </div>
      ) : null}

      {useSectionWizard ? (
        <div className="flex flex-wrap gap-2 pt-1">
          <button
            type="button"
            disabled={disabled || safeSectionIndex === 0}
            onClick={() => setActiveSectionIndex((i) => Math.max(0, i - 1))}
            className="inline-flex flex-1 items-center justify-center rounded-[6px] border border-border px-4 py-2.5 text-sm font-semibold text-foreground hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40 sm:flex-none"
          >
            Back
          </button>
          {!isLastProgressSection ? (
            <button
              type="button"
              disabled={disabled}
              onClick={() =>
                setActiveSectionIndex((i) =>
                  Math.min(progressSections.length - 1, i + 1),
                )
              }
              className="inline-flex flex-1 items-center justify-center rounded-[6px] bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-gray-300 sm:flex-none"
            >
              Next section
            </button>
          ) : !hideSubmitButton ? (
            <button
              type="submit"
              disabled={disabled || submitting}
              className="inline-flex flex-1 items-center justify-center rounded-[6px] bg-accent px-4 py-2.5 text-sm font-semibold text-white hover:bg-accent-hover disabled:cursor-not-allowed disabled:bg-gray-300 sm:flex-none"
            >
              {submitting ? 'Submitting…' : submitLabel ?? `Submit ${title}`}
            </button>
          ) : null}
        </div>
      ) : !hideSubmitButton ? (
        <button
          type="submit"
          disabled={disabled || submitting}
          className="inline-flex w-full items-center justify-center rounded-[6px] bg-accent px-4 py-2.5 text-sm font-semibold text-white hover:bg-accent-hover disabled:cursor-not-allowed disabled:bg-gray-300 sm:w-auto"
        >
          {submitting ? 'Submitting…' : submitLabel ?? `Submit ${title}`}
        </button>
      ) : null}
    </form>
  );
}

type FollowUp = { whenOption: string; question: SurveyQuestion };

function SurveyQuestionBlock(props: {
  question: SurveyQuestion;
  answers: Record<string, unknown>;
  setAnswer: (id: string, value: unknown) => void;
  disabled?: boolean;
}) {
  const { question, answers, setAnswer, disabled } = props;
  const id = String(question.id ?? question.prompt ?? 'field');
  const followUp = question.followUp as FollowUp | undefined;
  const parentValue = answers[id];

  return (
    <div className="space-y-4">
      <NativeQuestionField
        question={question}
        value={parentValue}
        onChange={(v) => setAnswer(id, v)}
        disabled={disabled}
      />
      {followUp && parentValue === followUp.whenOption ? (
        <NativeQuestionField
          question={followUp.question}
          value={answers[String(followUp.question.id ?? `${id}_follow_up`)]}
          onChange={(v) =>
            setAnswer(String(followUp.question.id ?? `${id}_follow_up`), v)
          }
          disabled={disabled}
        />
      ) : null}
    </div>
  );
}

function NativeQuestionField(props: {
  question: SurveyQuestion;
  value: unknown;
  onChange: (value: unknown) => void;
  disabled?: boolean;
}) {
  const { question, value, onChange, disabled } = props;
  const id = String(question.id ?? question.prompt ?? 'field');
  const prompt = question.prompt ?? id;
  const required = question.required !== false;

  if (question.type === 'info' || question.type === 'link') {
    return (
      <div className="text-sm text-muted-foreground">
        <p className="font-medium text-foreground">{prompt}</p>
      </div>
    );
  }

  if (question.type === 'long_text') {
    const hints = surveyFieldInputHints({
      questionId: id,
      syncToProfile: question.syncToProfile,
      prompt,
    });
    return (
      <label className="block space-y-1 text-sm">
        <span className="font-medium text-foreground">
          {prompt}
          {required ? ' *' : ''}
        </span>
        <textarea
          className="w-full rounded-[6px] border border-border px-3 py-2"
          rows={4}
          required={required}
          disabled={disabled}
          autoComplete={hints.autoComplete}
          name={id}
          value={typeof value === 'string' ? value : ''}
          onChange={(e) => onChange(e.target.value)}
        />
      </label>
    );
  }

  if (question.type === 'rating') {
    const min = typeof question.scaleMin === 'number' ? question.scaleMin : 1;
    const max = typeof question.scaleMax === 'number' ? question.scaleMax : 5;
    return (
      <fieldset className="space-y-2 text-sm" disabled={disabled}>
        <legend className="font-medium text-foreground">
          {prompt}
          {required ? ' *' : ''}
        </legend>
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: max - min + 1 }, (_, index) => min + index).map(
            (rating) => (
              <label
                key={rating}
                className="inline-flex min-w-10 cursor-pointer items-center justify-center rounded-[6px] border border-border px-3 py-2 has-[:checked]:border-brand-600 has-[:checked]:bg-brand-50"
              >
                <input
                  type="radio"
                  className="sr-only"
                  name={id}
                  required={required}
                  checked={value === rating}
                  onChange={() => onChange(rating)}
                />
                {rating}
              </label>
            ),
          )}
        </div>
      </fieldset>
    );
  }

  if (question.type === 'multi_choice' && Array.isArray(question.options)) {
    const selected = Array.isArray(value) ? (value as string[]) : [];
    const max = typeof question.maxSelections === 'number' ? question.maxSelections : undefined;
    return (
      <fieldset className="space-y-2 text-sm" disabled={disabled}>
        <legend className="font-medium text-foreground">
          {prompt}
          {required ? ' *' : ''}
          {max ? ` (up to ${max})` : ''}
        </legend>
        {question.options.map((opt) => (
          <label key={opt} className="flex items-start gap-2">
            <input
              type="checkbox"
              checked={selected.includes(opt)}
              onChange={(e) => {
                if (e.target.checked) {
                  const next = [...selected, opt];
                  onChange(max ? next.slice(0, max) : next);
                } else {
                  onChange(selected.filter((x) => x !== opt));
                }
              }}
            />
            <span>{opt}</span>
          </label>
        ))}
      </fieldset>
    );
  }

  if (question.type === 'single_choice' && Array.isArray(question.options)) {
    return (
      <fieldset className="space-y-2 text-sm" disabled={disabled}>
        <legend className="font-medium text-foreground">
          {prompt}
          {required ? ' *' : ''}
        </legend>
        {question.options.map((opt) => (
          <label key={opt} className="flex items-start gap-2">
            <input
              type="radio"
              name={id}
              required={required}
              checked={value === opt}
              onChange={() => onChange(opt)}
            />
            <span>{opt}</span>
          </label>
        ))}
      </fieldset>
    );
  }

  const hints = surveyFieldInputHints({
    questionId: id,
    syncToProfile: question.syncToProfile,
    prompt,
  });

  return (
    <label className="block space-y-1 text-sm">
      <span className="font-medium text-foreground">
        {prompt}
        {required ? ' *' : ''}
      </span>
      <input
        type={hints.inputType}
        name={id}
        className="w-full rounded-[6px] border border-border px-3 py-2"
        required={required}
        disabled={disabled}
        autoComplete={hints.autoComplete}
        value={typeof value === 'string' ? value : ''}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}
