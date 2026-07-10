import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { SurveyQuestion } from '../api/surveys';
import {
  isIdentitySurveyQuestion,
  listNativeSurveyQuestions,
  surveyHasNativeQuestions,
} from '../../utils/survey-questions';

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
};

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
}: Props) {
  const visibleQuestions = useMemo(() => {
    const all = listNativeSurveyQuestions(questions);
    if (!authenticated) return all;
    return all.filter((q) => !isIdentitySurveyQuestion(q));
  }, [questions, authenticated]);

  const [answers, setAnswers] = useState<Record<string, unknown>>({});

  if (!surveyHasNativeQuestions(questions)) {
    return (
      <p className="text-sm text-gray-600">
        This survey is not available as a native form yet. Contact support if you need assistance.
      </p>
    );
  }

  const setAnswer = (id: string, value: unknown) => {
    setAnswers((prev) => ({ ...prev, [id]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(answers);
  };

  return (
    <form
      id={formId}
      onSubmit={handleSubmit}
      className="space-y-5"
      data-survey-id={surveyId}
    >
      {authenticated && userSummary ? (
        <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700">
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

      {visibleQuestions.map((q, idx) => (
        <SurveyQuestionBlock
          key={q.id ?? `q-${idx}`}
          question={q}
          answers={answers}
          setAnswer={setAnswer}
          disabled={disabled}
        />
      ))}

      {showPayoutNotice ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-950">
          W-9 and honorarium payout details are managed in your{' '}
          <Link to={w9ProfileHref} className="font-semibold underline">
            profile &amp; payments
          </Link>
          . Complete those after you submit this survey if you have not already.
        </div>
      ) : null}

      {!hideSubmitButton ? (
        <button
          type="submit"
          disabled={disabled || submitting}
          className="inline-flex items-center justify-center rounded-lg bg-orange-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-orange-700 disabled:cursor-not-allowed disabled:bg-gray-300"
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
      <div className="text-sm text-gray-700">
        <p className="font-medium text-gray-900">{prompt}</p>
      </div>
    );
  }

  if (question.type === 'long_text') {
    return (
      <label className="block space-y-1 text-sm">
        <span className="font-medium text-gray-900">
          {prompt}
          {required ? ' *' : ''}
        </span>
        <textarea
          className="w-full rounded-lg border border-gray-300 px-3 py-2"
          rows={4}
          required={required}
          disabled={disabled}
          value={typeof value === 'string' ? value : ''}
          onChange={(e) => onChange(e.target.value)}
        />
      </label>
    );
  }

  if (question.type === 'multi_choice' && Array.isArray(question.options)) {
    const selected = Array.isArray(value) ? (value as string[]) : [];
    const max = typeof question.maxSelections === 'number' ? question.maxSelections : undefined;
    return (
      <fieldset className="space-y-2 text-sm" disabled={disabled}>
        <legend className="font-medium text-gray-900">
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
        <legend className="font-medium text-gray-900">
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

  return (
    <label className="block space-y-1 text-sm">
      <span className="font-medium text-gray-900">
        {prompt}
        {required ? ' *' : ''}
      </span>
      <input
        className="w-full rounded-lg border border-gray-300 px-3 py-2"
        required={required}
        disabled={disabled}
        value={typeof value === 'string' ? value : ''}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}
