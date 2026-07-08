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

  it('detects intake from env default URL', async () => {
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

    expect(meta.hasIntakeSurvey).toBe(true);
    expect(meta.intakeUsesJotform).toBe(true);
  });
});

describe('isPostEventSurveyWithinWindow', () => {
  it('allows access within 7 days of survey creation', () => {
    const created = new Date('2026-06-01T12:00:00Z');
    const now = created.getTime() + POST_EVENT_SURVEY_WINDOW_MS - 60_000;
    expect(isPostEventSurveyWithinWindow(created, now)).toBe(true);
  });

  it('denies access after 7 days from survey creation', () => {
    const created = new Date('2026-06-01T12:00:00Z');
    const now = created.getTime() + POST_EVENT_SURVEY_WINDOW_MS + 1;
    expect(isPostEventSurveyWithinWindow(created, now)).toBe(false);
  });
});
