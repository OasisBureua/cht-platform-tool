import {
  findUnsafeAnsweredQuestionChanges,
  hasNativeSurveySchema,
  listNativeSurveyQuestions,
  validateNativeSurveySchema,
} from './survey-schema';

describe('survey-schema', () => {
  describe('listNativeSurveyQuestions', () => {
    it('flattens sections and preserves type, options, maxSelections', () => {
      const questions = {
        sections: [
          {
            id: 's1',
            questions: [
              {
                id: 'q1',
                type: 'single_choice',
                prompt: 'Role?',
                options: ['MD', 'NP', 'PA'],
                required: true,
              },
              {
                id: 'q2',
                type: 'multi_choice',
                prompt: 'Factors',
                options: ['A', 'B', 'C'],
                maxSelections: 2,
              },
            ],
          },
          {
            id: 's2',
            questions: [{ id: 'q3', type: 'long_text', prompt: 'Notes' }],
          },
        ],
      };

      const result = listNativeSurveyQuestions(questions);

      expect(result.map((q) => q.id)).toEqual(['q1', 'q2', 'q3']);
      expect(result[0]).toMatchObject({
        type: 'single_choice',
        options: ['MD', 'NP', 'PA'],
        required: true,
      });
      expect(result[1]).toMatchObject({
        type: 'multi_choice',
        options: ['A', 'B', 'C'],
        maxSelections: 2,
      });
      expect(result[2].type).toBe('long_text');
    });

    it('expands followUp sub-questions after their parent', () => {
      const result = listNativeSurveyQuestions({
        sections: [
          {
            id: 'clinical',
            questions: [
              {
                id: 'q6',
                type: 'single_choice',
                prompt: 'Initial regimen?',
                options: ['THP', 'Other'],
                followUp: {
                  whenOption: 'Other',
                  question: {
                    id: 'q6_other',
                    type: 'text',
                    prompt: 'Briefly describe:',
                    required: false,
                  },
                },
              },
            ],
          },
        ],
      });

      expect(result.map((q) => q.id)).toEqual(['q6', 'q6_other']);
      expect(result[1]).toMatchObject({
        type: 'text',
        prompt: 'Briefly describe:',
        required: false,
      });
    });

    it('supports a top-level questions array', () => {
      const result = listNativeSurveyQuestions([
        { id: 'a', prompt: 'A' },
        { id: 'b', prompt: 'B' },
      ]);
      expect(result.map((q) => q.id)).toEqual(['a', 'b']);
    });

    it('tolerates sections without a questions array', () => {
      const result = listNativeSurveyQuestions({
        sections: [{ id: 's1' }, { id: 's2', questions: [{ id: 'q1' }] }],
      });
      expect(result.map((q) => q.id)).toEqual(['q1']);
    });

    it('returns [] for Jotform-sourced, empty, or malformed schemas', () => {
      expect(
        listNativeSurveyQuestions({ source: 'jotform', formId: '123' }),
      ).toEqual([]);
      expect(listNativeSurveyQuestions(null)).toEqual([]);
      expect(listNativeSurveyQuestions(undefined)).toEqual([]);
      expect(listNativeSurveyQuestions('nope')).toEqual([]);
      expect(listNativeSurveyQuestions({})).toEqual([]);
    });
  });

  describe('hasNativeSurveySchema', () => {
    it('is true when at least one question has an id', () => {
      expect(
        hasNativeSurveySchema({ sections: [{ questions: [{ id: 'q1' }] }] }),
      ).toBe(true);
    });

    it('is false for Jotform-sourced or empty schemas', () => {
      expect(hasNativeSurveySchema({ source: 'jotform', formId: '123' })).toBe(
        false,
      );
      expect(hasNativeSurveySchema({ sections: [] })).toBe(false);
      expect(hasNativeSurveySchema(null)).toBe(false);
    });
  });

  describe('validateNativeSurveySchema', () => {
    it('accepts the editable question types and preserves stable ids', () => {
      const schema = validateNativeSurveySchema({
        version: 2,
        sections: [
          {
            id: 'main',
            title: 'Main',
            questions: [
              {
                id: 'rating',
                type: 'rating',
                prompt: 'Rate this',
                scaleMin: 1,
                scaleMax: 5,
              },
              {
                id: 'choice',
                type: 'single_choice',
                prompt: 'Choose',
                options: ['A', 'B'],
              },
            ],
          },
        ],
      });

      expect(schema.version).toBe(2);
      expect(schema.sections[0].questions.map((q) => q.id)).toEqual([
        'rating',
        'choice',
      ]);
    });

    it('rejects duplicate ids and invalid choice options', () => {
      expect(() =>
        validateNativeSurveySchema({
          sections: [
            {
              id: 'main',
              questions: [
                { id: 'same', type: 'text', prompt: 'One' },
                { id: 'same', type: 'text', prompt: 'Two' },
              ],
            },
          ],
        }),
      ).toThrow('Duplicate question id');

      expect(() =>
        validateNativeSurveySchema({
          sections: [
            {
              id: 'main',
              questions: [
                {
                  id: 'choice',
                  type: 'single_choice',
                  prompt: 'Choose',
                  options: [],
                },
              ],
            },
          ],
        }),
      ).toThrow('requires non-empty options');
    });
  });

  describe('findUnsafeAnsweredQuestionChanges', () => {
    const current = {
      sections: [
        {
          id: 'main',
          questions: [
            {
              id: 'q1',
              type: 'single_choice',
              prompt: 'Original',
              options: ['A', 'B'],
            },
          ],
        },
      ],
    };

    it('allows additions while preserving existing mappings', () => {
      const next = {
        sections: [
          {
            id: 'main',
            questions: [
              ...current.sections[0].questions,
              { id: 'q2', type: 'text', prompt: 'New' },
            ],
          },
        ],
      };
      expect(findUnsafeAnsweredQuestionChanges(current, next)).toEqual([]);
    });

    it('detects removal and reinterpretation', () => {
      expect(
        findUnsafeAnsweredQuestionChanges(current, {
          sections: [{ id: 'main', questions: [] }],
        }),
      ).toContain('q1: removing an existing question');
      expect(
        findUnsafeAnsweredQuestionChanges(current, {
          sections: [
            {
              id: 'main',
              questions: [
                {
                  ...current.sections[0].questions[0],
                  type: 'multi_choice',
                },
              ],
            },
          ],
        }),
      ).toContain('q1: changing question type');
    });
  });
});
