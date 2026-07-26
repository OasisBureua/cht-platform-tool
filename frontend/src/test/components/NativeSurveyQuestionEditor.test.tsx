import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { NativeSurveyQuestionEditor } from '../../components/admin/NativeSurveyQuestionEditor';
import type { EditableSurveySchema } from '../../utils/native-survey-editor';

const schema: EditableSurveySchema = {
  version: 1,
  sections: [
    {
      id: 'main',
      title: 'Questions',
      questions: [
        {
          id: 'q1',
          type: 'text',
          prompt: 'Existing question',
          required: true,
        },
      ],
    },
  ],
};

describe('NativeSurveyQuestionEditor', () => {
  it('adds a new question to an auto-generated survey section', () => {
    const onChange = vi.fn();
    render(<NativeSurveyQuestionEditor value={schema} onChange={onChange} />);

    fireEvent.click(screen.getByRole('button', { name: 'Add question' }));

    expect(onChange).toHaveBeenCalledOnce();
    const next = onChange.mock.calls[0][0] as EditableSurveySchema;
    expect(next.sections[0].questions).toHaveLength(2);
    expect(next.sections[0].questions[1]).toMatchObject({
      type: 'text',
      prompt: 'New question',
      required: false,
    });
    expect(next.sections[0].questions[1].id).toMatch(/^q_/);
  });

  it('lets admins choose the question type', () => {
    const onChange = vi.fn();
    render(<NativeSurveyQuestionEditor value={schema} onChange={onChange} />);

    fireEvent.change(screen.getByLabelText('Question type'), {
      target: { value: 'single_choice' },
    });

    const next = onChange.mock.calls[0][0] as EditableSurveySchema;
    expect(next.sections[0].questions[0]).toMatchObject({
      type: 'single_choice',
      options: ['Option 1', 'Option 2'],
    });
  });

  it('locks destructive edits for questions with response mappings', () => {
    render(
      <NativeSurveyQuestionEditor
        value={schema}
        onChange={vi.fn()}
        lockedQuestionIds={new Set(['q1'])}
      />,
    );

    expect(screen.getByDisplayValue('Existing question')).toBeDisabled();
    expect(
      screen.getByRole('button', { name: 'Delete question' }),
    ).toBeDisabled();
    expect(screen.getByText('Has response mapping')).toBeInTheDocument();
  });
});
