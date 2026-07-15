import {
  hasNativeSurveySchema,
  listNativeSurveyQuestions,
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
      expect(listNativeSurveyQuestions({ source: 'jotform', formId: '123' })).toEqual([]);
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
      expect(hasNativeSurveySchema({ source: 'jotform', formId: '123' })).toBe(false);
      expect(hasNativeSurveySchema({ sections: [] })).toBe(false);
      expect(hasNativeSurveySchema(null)).toBe(false);
    });
  });
});
