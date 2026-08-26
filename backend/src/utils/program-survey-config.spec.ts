import { ProgramZoomSessionType } from '@prisma/client';
import {
  isPostEventSurveyWithinWindow,
  loadProgramSurveyMeta,
  POST_EVENT_SURVEY_WINDOW_MS,
} from './program-survey-config';

describe('loadProgramSurveyMeta', () => {
  const prisma = {
    survey: {
      findFirst: jest.fn(),
    },
  };

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('detects post-event from FEEDBACK survey row', async () => {
    prisma.survey.findFirst
      .mockResolvedValueOnce({ id: 'fb-1', jotformFormId: '123' })
      .mockResolvedValueOnce(null);

    const meta = await loadProgramSurveyMeta(
      prisma,
      {
        id: 'p1',
        jotformSurveyUrl: null,
        jotformIntakeFormUrl: null,
        zoomSessionType: ProgramZoomSessionType.WEBINAR,
      },
      undefined,
    );

    expect(meta.hasPostEventSurvey).toBe(true);
    expect(meta.feedbackSurveyId).toBe('fb-1');
    expect(meta.feedbackUsesJotform).toBe(true);
  });

  it('detects intake only from native INTAKE survey row', async () => {
    prisma.survey.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: 'intake-1',
        jotformFormId: null,
        questions: [{ id: 'q1', type: 'text', label: 'Name' }],
      });

    const meta = await loadProgramSurveyMeta(
      prisma,
      {
        id: 'p1',
        jotformSurveyUrl: null,
        jotformIntakeFormUrl: 'https://communityhealthmedia.jotform.com/old',
        zoomSessionType: ProgramZoomSessionType.WEBINAR,
      },
      'https://communityhealthmedia.jotform.com/261116295463861',
    );

    expect(meta.hasIntakeSurvey).toBe(true);
    expect(meta.intakeSurveyId).toBe('intake-1');
    expect(meta.intakeUsesJotform).toBe(false);
  });

  it('ignores jotform-only intake defaults when no native survey exists', async () => {
    prisma.survey.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);

    const meta = await loadProgramSurveyMeta(
      prisma,
      {
        id: 'p1',
        jotformSurveyUrl: null,
        jotformIntakeFormUrl: null,
        zoomSessionType: ProgramZoomSessionType.WEBINAR,
      },
      'https://communityhealthmedia.jotform.com/261116295463861',
    );

    expect(meta.hasIntakeSurvey).toBe(false);
    expect(meta.intakeUsesJotform).toBe(false);
  });
});

describe('isPostEventSurveyWithinWindow', () => {
  it('allows access within 7 days of session unlock', () => {
    const unlock = new Date('2026-06-10T12:00:00Z');
    const now = unlock.getTime() + POST_EVENT_SURVEY_WINDOW_MS - 60_000;
    expect(isPostEventSurveyWithinWindow(unlock, now)).toBe(true);
  });

  it('denies access after 7 days from session unlock', () => {
    const unlock = new Date('2026-06-10T12:00:00Z');
    const now = unlock.getTime() + POST_EVENT_SURVEY_WINDOW_MS + 1;
    expect(isPostEventSurveyWithinWindow(unlock, now)).toBe(false);
  });

  it('denies access before session unlock', () => {
    const unlock = new Date('2026-06-10T12:00:00Z');
    const now = unlock.getTime() - 60_000;
    expect(isPostEventSurveyWithinWindow(unlock, now)).toBe(false);
  });
});
