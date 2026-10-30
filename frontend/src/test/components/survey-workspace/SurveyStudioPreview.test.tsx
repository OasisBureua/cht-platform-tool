import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import { SurveyStudioPreview } from '../../../components/admin/survey-workspace/SurveyStudioPreview';
import type { Survey } from '../../../api/surveys';

const nativeSurvey: Survey = {
  id: 'sv-preview',
  programId: 'p1',
  title: 'Post-event feedback',
  description: 'Tell us how it went.',
  questions: {
    sections: [
      {
        id: 'main',
        title: 'Main',
        questions: [
          {
            id: 'q1',
            type: 'long_text',
            prompt: 'What will you change?',
            required: true,
          },
        ],
      },
    ],
  },
  type: 'FEEDBACK',
  required: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  program: { id: 'p1', title: 'Webinar' },
};

describe('SurveyStudioPreview', () => {
  it('renders participant form without a submit control', () => {
    render(
      <MemoryRouter>
        <SurveyStudioPreview survey={nativeSurvey} />
      </MemoryRouter>,
    );

    expect(screen.getByText('Preview only — no response saved')).toBeInTheDocument();
    expect(screen.getByText(/What will you change\?/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /submit/i })).not.toBeInTheDocument();
  });

  it('toggles device chrome between desktop and mobile', () => {
    render(
      <MemoryRouter>
        <SurveyStudioPreview survey={nativeSurvey} />
      </MemoryRouter>,
    );

    const mobile = screen.getByRole('button', { name: /^mobile$/i });
    fireEvent.click(mobile);
    expect(mobile).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /^desktop$/i })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('shows a calm Jotform empty state when there is no native schema', () => {
    render(
      <MemoryRouter>
        <SurveyStudioPreview
          survey={{
            ...nativeSurvey,
            questions: { source: 'jotform' },
            jotformFormId: 'jf-123',
          }}
        />
      </MemoryRouter>,
    );

    expect(screen.getByText(/No native preview for this survey/i)).toBeInTheDocument();
    expect(screen.getByText(/jf-123/)).toBeInTheDocument();
  });
});

describe('NativeSurveyForm previewMode (no submit)', () => {
  it('ignores form submit attempts in preview mode', async () => {
    const { NativeSurveyForm } = await import(
      '../../../components/surveys/NativeSurveyForm'
    );
    const onSubmit = vi.fn();

    const { container } = render(
      <NativeSurveyForm
        surveyId="preview:sv"
        title="Feedback"
        questions={nativeSurvey.questions}
        authenticated
        previewMode
        onSubmit={onSubmit}
      />,
    );

    const form = container.querySelector('form');
    expect(form).toBeTruthy();
    fireEvent.submit(form!);
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: /submit/i })).not.toBeInTheDocument();
  });
});
