import { ConfigService } from '@nestjs/config';
import { ProgramRegistrationStatus, SurveyType } from '@prisma/client';

jest.mock('../programs/program-registrations.service', () => ({
  ProgramRegistrationsService: class ProgramRegistrationsService {},
}));
jest.mock('../programs/form-jotform-progress.service', () => ({
  FormJotformProgressService: class FormJotformProgressService {},
}));
jest.mock('../outbound-sync/outbound-sync.service', () => ({
  OutboundSyncService: class OutboundSyncService {},
}));

import { SurveysService } from './surveys.service';
import { PrismaService } from '../../prisma/prisma.service';
import { QueueService } from '../../queue/queue.service';
import { OutboundSyncService } from '../outbound-sync/outbound-sync.service';
import { FormJotformProgressService } from '../programs/form-jotform-progress.service';
import { ProgramRegistrationsService } from '../programs/program-registrations.service';

const betaQuestions = {
  sections: [
    {
      id: 's1',
      questions: [
        {
          id: 'ease_access',
          type: 'single_choice',
          prompt: 'How easy was access?',
          options: [
            'Very difficult',
            'Difficult',
            'Neutral',
            'Easy',
            'Very easy',
          ],
          scoring: { kind: 'ease', stage: 'access' },
        },
        {
          id: 'nps',
          type: 'number',
          prompt: 'Recommend?',
          scaleMin: 0,
          scaleMax: 10,
          scoring: { kind: 'nps' },
        },
      ],
    },
  ],
};

describe('SurveysService.getWorkspaceStatsForAdmin', () => {
  let service: SurveysService;
  let prisma: {
    survey: { count: jest.Mock; findMany: jest.Mock };
    surveyResponse: {
      count: jest.Mock;
      findMany: jest.Mock;
      groupBy: jest.Mock;
    };
    programRegistration: { groupBy: jest.Mock };
  };

  beforeEach(() => {
    prisma = {
      survey: { count: jest.fn(), findMany: jest.fn() },
      surveyResponse: {
        count: jest.fn(),
        findMany: jest.fn(),
        groupBy: jest.fn(),
      },
      programRegistration: { groupBy: jest.fn() },
    };

    service = new SurveysService(
      prisma as unknown as PrismaService,
      {} as QueueService,
      { get: jest.fn() } as unknown as ConfigService,
      {} as OutboundSyncService,
      {} as FormJotformProgressService,
      {} as ProgramRegistrationsService,
    );
  });

  it('returns totals, filled 30-day trend, beta KPIs, and needs attention', async () => {
    prisma.survey.count.mockResolvedValue(2);
    prisma.surveyResponse.count.mockResolvedValue(3);
    prisma.survey.findMany.mockResolvedValue([
      {
        id: 'fb-1',
        title: 'Beta feedback',
        type: SurveyType.FEEDBACK,
        questions: betaQuestions,
        programId: 'prog-1',
        program: { id: 'prog-1', title: 'Cardiology Webinar' },
      },
      {
        id: 'empty-1',
        title: 'Empty intake',
        type: SurveyType.INTAKE,
        questions: { sections: [] },
        programId: 'prog-2',
        program: { id: 'prog-2', title: 'Oncology OH' },
      },
    ]);
    prisma.surveyResponse.groupBy.mockResolvedValue([
      { surveyId: 'fb-1', _count: { _all: 3 } },
    ]);

    const today = new Date();
    today.setUTCHours(12, 0, 0, 0);
    prisma.surveyResponse.findMany
      .mockResolvedValueOnce([
        { submittedAt: today },
        { submittedAt: today },
      ])
      .mockResolvedValueOnce([
        {
          id: 'r1',
          surveyId: 'fb-1',
          userId: 'u1',
          submittedAt: today,
          score: null,
          answers: { ease_access: 'Easy', nps: 9 },
          commentStageTags: [],
        },
        {
          id: 'r2',
          surveyId: 'fb-1',
          userId: 'u2',
          submittedAt: today,
          score: null,
          answers: { ease_access: 'Very easy', nps: 10 },
          commentStageTags: [],
        },
        {
          id: 'r3',
          surveyId: 'fb-1',
          userId: 'u3',
          submittedAt: today,
          score: null,
          answers: { ease_access: 'Neutral', nps: 6 },
          commentStageTags: [],
        },
      ]);

    prisma.programRegistration.groupBy.mockResolvedValue([
      {
        programId: 'prog-1',
        _count: { _all: 10 },
        status: ProgramRegistrationStatus.APPROVED,
      },
    ]);

    const result = await service.getWorkspaceStatsForAdmin();

    expect(prisma.surveyResponse.count).toHaveBeenCalledWith({
      where: { isDraft: false },
    });
    expect(prisma.surveyResponse.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({ where: { isDraft: false } }),
    );
    expect(prisma.surveyResponse.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ isDraft: false }),
      }),
    );

    expect(result.totalSurveys).toBe(2);
    expect(result.totalResponses).toBe(3);
    expect(result.responsesLast30Days).toBe(2);
    expect(result.trend).toHaveLength(30);
    expect(result.trend.reduce((s, p) => s + p.count, 0)).toBe(2);
    expect(result.completionRate).toBe(30);
    expect(result.averageEaseScore).toBeGreaterThan(0);
    expect(result.npsScore).not.toBeNull();
    expect(result.needsAttention.some((item) => item.id === 'empty-1')).toBe(
      true,
    );
    expect(
      result.needsAttention.some(
        (item) => item.id === 'fb-1' && item.kind === 'low_completion',
      ),
    ).toBe(true);
  });
});
