import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import type {
  EditableQuestionType,
  EditableSurveyQuestion,
  EditableSurveySchema,
  EditableSurveySection,
} from '../../utils/native-survey-editor';

const QUESTION_TYPES: Array<{ value: EditableQuestionType; label: string }> = [
  { value: 'text', label: 'Short text' },
  { value: 'long_text', label: 'Long text' },
  { value: 'single_choice', label: 'Single choice' },
  { value: 'multi_choice', label: 'Multiple choice' },
  { value: 'rating', label: 'Rating' },
  { value: 'info', label: 'Information text' },
];

function newId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 7)}`;
}

function newQuestion(): EditableSurveyQuestion {
  return {
    id: newId('q'),
    type: 'text',
    prompt: 'New question',
    required: false,
  };
}

export function NativeSurveyQuestionEditor({
  value,
  onChange,
  lockedQuestionIds = new Set<string>(),
}: {
  value: EditableSurveySchema;
  onChange: (value: EditableSurveySchema) => void;
  /** Existing answered questions: prompt/type/options/removal are immutable. */
  lockedQuestionIds?: ReadonlySet<string>;
}) {
  const updateSection = (
    sectionIndex: number,
    updater: (section: EditableSurveySection) => EditableSurveySection,
  ) => {
    onChange({
      ...value,
      sections: value.sections.map((section, index) =>
        index === sectionIndex ? updater(section) : section,
      ),
    });
  };

  const updateQuestion = (
    sectionIndex: number,
    questionIndex: number,
    patch: Partial<EditableSurveyQuestion>,
  ) => {
    updateSection(sectionIndex, (section) => ({
      ...section,
      questions: section.questions.map((question, index) =>
        index === questionIndex ? { ...question, ...patch } : question,
      ),
    }));
  };

  const moveQuestion = (
    sectionIndex: number,
    questionIndex: number,
    delta: -1 | 1,
  ) => {
    updateSection(sectionIndex, (section) => {
      const next = [...section.questions];
      const target = questionIndex + delta;
      if (target < 0 || target >= next.length) return section;
      [next[questionIndex], next[target]] = [next[target], next[questionIndex]];
      return { ...section, questions: next };
    });
  };

  return (
    <div className="space-y-5">
      {value.sections.map((section, sectionIndex) => (
        <section
          key={section.id}
          className="space-y-4 rounded-2xl border border-gray-200 bg-gray-50/60 p-4"
        >
          <div className="flex items-center gap-3">
            <input
              value={section.title ?? ''}
              onChange={(event) =>
                updateSection(sectionIndex, (current) => ({
                  ...current,
                  title: event.target.value,
                }))
              }
              aria-label={`Section ${sectionIndex + 1} title`}
              className="min-w-0 flex-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-semibold"
              placeholder="Section title"
            />
            {value.sections.length > 1 && section.questions.length === 0 ? (
              <button
                type="button"
                onClick={() =>
                  onChange({
                    ...value,
                    sections: value.sections.filter(
                      (_, index) => index !== sectionIndex,
                    ),
                  })
                }
                className="rounded-lg p-2 text-gray-500 hover:bg-red-50 hover:text-red-700"
                aria-label="Delete empty section"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            ) : null}
          </div>

          {section.questions.map((question, questionIndex) => {
            const locked = lockedQuestionIds.has(question.id);
            const isChoice =
              question.type === 'single_choice' ||
              question.type === 'multi_choice';
            return (
              <div
                key={question.id}
                className="space-y-3 rounded-xl border border-gray-200 bg-white p-4"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs text-gray-400">
                    {question.id}
                  </span>
                  {locked ? (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                      Has response mapping
                    </span>
                  ) : null}
                  <div className="ml-auto flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() =>
                        moveQuestion(sectionIndex, questionIndex, -1)
                      }
                      disabled={questionIndex === 0}
                      className="rounded p-1.5 text-gray-500 hover:bg-gray-100 disabled:opacity-30"
                      aria-label="Move question up"
                    >
                      <ArrowUp className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        moveQuestion(sectionIndex, questionIndex, 1)
                      }
                      disabled={questionIndex === section.questions.length - 1}
                      className="rounded p-1.5 text-gray-500 hover:bg-gray-100 disabled:opacity-30"
                      aria-label="Move question down"
                    >
                      <ArrowDown className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        updateSection(sectionIndex, (current) => ({
                          ...current,
                          questions: current.questions.filter(
                            (_, index) => index !== questionIndex,
                          ),
                        }))
                      }
                      disabled={locked}
                      className="rounded p-1.5 text-gray-500 hover:bg-red-50 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-30"
                      aria-label="Delete question"
                      title={
                        locked
                          ? 'Cannot remove a question after responses exist'
                          : 'Delete question'
                      }
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-[180px_1fr]">
                  <label className="space-y-1 text-xs font-semibold text-gray-600">
                    Question type
                    <select
                      value={question.type}
                      disabled={locked}
                      onChange={(event) => {
                        const type = event.target.value as EditableQuestionType;
                        updateQuestion(sectionIndex, questionIndex, {
                          type,
                          ...(type === 'single_choice' ||
                          type === 'multi_choice'
                            ? {
                                options: question.options?.length
                                  ? question.options
                                  : ['Option 1', 'Option 2'],
                              }
                            : { options: undefined, maxSelections: undefined }),
                          ...(type === 'rating'
                            ? { scaleMin: 1, scaleMax: 5 }
                            : {}),
                        });
                      }}
                      className="block w-full rounded-lg border border-gray-200 px-3 py-2 text-sm font-normal disabled:bg-gray-100"
                    >
                      {QUESTION_TYPES.map((type) => (
                        <option key={type.value} value={type.value}>
                          {type.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="space-y-1 text-xs font-semibold text-gray-600">
                    Prompt
                    <input
                      value={question.prompt}
                      disabled={locked}
                      onChange={(event) =>
                        updateQuestion(sectionIndex, questionIndex, {
                          prompt: event.target.value,
                        })
                      }
                      className="block w-full rounded-lg border border-gray-200 px-3 py-2 text-sm font-normal disabled:bg-gray-100"
                      required
                    />
                  </label>
                </div>

                {isChoice ? (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-gray-600">
                      Options
                    </p>
                    {(question.options ?? []).map((option, optionIndex) => (
                      <div
                        key={`${question.id}-option-${optionIndex}`}
                        className="flex items-center gap-2"
                      >
                        <input
                          value={option}
                          disabled={locked}
                          onChange={(event) => {
                            const options = [...(question.options ?? [])];
                            options[optionIndex] = event.target.value;
                            updateQuestion(sectionIndex, questionIndex, {
                              options,
                            });
                          }}
                          className="min-w-0 flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm disabled:bg-gray-100"
                          required
                        />
                        <button
                          type="button"
                          disabled={
                            locked || (question.options?.length ?? 0) <= 1
                          }
                          onClick={() =>
                            updateQuestion(sectionIndex, questionIndex, {
                              options: (question.options ?? []).filter(
                                (_, index) => index !== optionIndex,
                              ),
                            })
                          }
                          className="rounded p-2 text-gray-400 hover:text-red-700 disabled:opacity-30"
                          aria-label="Delete option"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      disabled={locked}
                      onClick={() =>
                        updateQuestion(sectionIndex, questionIndex, {
                          options: [
                            ...(question.options ?? []),
                            `Option ${(question.options?.length ?? 0) + 1}`,
                          ],
                        })
                      }
                      className="text-xs font-semibold text-brand-700 disabled:text-gray-400"
                    >
                      + Add option
                    </button>
                    {question.type === 'multi_choice' ? (
                      <label className="block max-w-xs space-y-1 text-xs font-semibold text-gray-600">
                        Maximum selections
                        <input
                          type="number"
                          min={1}
                          max={question.options?.length ?? 1}
                          value={
                            question.maxSelections ??
                            question.options?.length ??
                            1
                          }
                          disabled={locked}
                          onChange={(event) =>
                            updateQuestion(sectionIndex, questionIndex, {
                              maxSelections: Number(event.target.value),
                            })
                          }
                          className="block w-full rounded-lg border border-gray-200 px-3 py-2 text-sm font-normal disabled:bg-gray-100"
                        />
                      </label>
                    ) : null}
                  </div>
                ) : null}

                {question.type === 'rating' ? (
                  <div className="grid max-w-sm grid-cols-2 gap-3">
                    <label className="space-y-1 text-xs font-semibold text-gray-600">
                      Minimum
                      <input
                        type="number"
                        value={question.scaleMin ?? 1}
                        disabled={locked}
                        onChange={(event) =>
                          updateQuestion(sectionIndex, questionIndex, {
                            scaleMin: Number(event.target.value),
                          })
                        }
                        className="block w-full rounded-lg border border-gray-200 px-3 py-2 text-sm font-normal disabled:bg-gray-100"
                      />
                    </label>
                    <label className="space-y-1 text-xs font-semibold text-gray-600">
                      Maximum
                      <input
                        type="number"
                        value={question.scaleMax ?? 5}
                        disabled={locked}
                        onChange={(event) =>
                          updateQuestion(sectionIndex, questionIndex, {
                            scaleMax: Number(event.target.value),
                          })
                        }
                        className="block w-full rounded-lg border border-gray-200 px-3 py-2 text-sm font-normal disabled:bg-gray-100"
                      />
                    </label>
                  </div>
                ) : null}

                {question.type !== 'info' ? (
                  <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                    <input
                      type="checkbox"
                      checked={question.required !== false}
                      onChange={(event) =>
                        updateQuestion(sectionIndex, questionIndex, {
                          required: event.target.checked,
                        })
                      }
                    />
                    Required
                  </label>
                ) : null}
              </div>
            );
          })}

          <button
            type="button"
            onClick={() =>
              updateSection(sectionIndex, (current) => ({
                ...current,
                questions: [...current.questions, newQuestion()],
              }))
            }
            className="inline-flex items-center gap-2 rounded-lg border border-brand-200 bg-white px-3 py-2 text-sm font-semibold text-brand-700 hover:bg-brand-50"
          >
            <Plus className="h-4 w-4" />
            Add question
          </button>
        </section>
      ))}

      <button
        type="button"
        onClick={() =>
          onChange({
            ...value,
            sections: [
              ...value.sections,
              {
                id: newId('section'),
                title: 'New section',
                questions: [],
              },
            ],
          })
        }
        className="inline-flex items-center gap-2 text-sm font-semibold text-gray-700 hover:text-gray-900"
      >
        <Plus className="h-4 w-4" />
        Add section
      </button>
    </div>
  );
}
