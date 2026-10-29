import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SurveyType } from '@prisma/client';

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

function analyticsFixture(overrides: {
  id: string;
  title: string;
  programTitle: string;
  meanEase?: number;
  nps?: number;
  prompt?: string;
  mean?: number;
}) {
  return {
    survey: {
      id: overrides.id,
      title: overrides.title,
      type: SurveyType.FEEDBACK,
      program: { id: `p-${overrides.id}`, title: overrides.programTitle },
    },
    analytics: {
      surveyType: SurveyType.FEEDBACK,
      hasNativeSchema: true,
      totals: {
        totalResponses: 5,
        uniqueRespondents: 5,
        firstResponseAt: null,
        lastResponseAt: null,
        completionRate: { eligible: 10, completed: 5, rate: 50 },
        score: null,
      },
      timeSeries: [],
      questions: [
        {
          id: 'q1',
          prompt: overrides.prompt ?? 'How satisfied were you?',
          type: 'rating',
          kind: 'rating' as const,
          count: 5,
          mean: overrides.mean ?? 4.2,
          median: 4,
          min: 3,
          max: 5,
          histogram: [],
        },
      ],
      segments: null,
      betaInsights: {
        easeByStage: [
          {
            stage: 'access',
            questionId: 'ease',
            prompt: 'Ease?',
            average: overrides.meanEase ?? 4.1,
            count: 5,
          },
        ],
        nps: {
          questionId: 'nps',
          prompt: 'Recommend?',
          score: overrides.nps ?? 40,
          promoters: 3,
          passives: 1,
          detractors: 1,
          totalRated: 5,
        },
        comments: [],
      },
    },
  };
}

describe('SurveysService.compareSurveysForAdmin', () => {
  let service: SurveysService;

  beforeEach(() => {
    service = new SurveysService(
      {} as PrismaService,
      {} as QueueService,
      { get: jest.fn() } as unknown as ConfigService,
      {} as OutboundSyncService,
      {} as FormJotformProgressService,
      {} as ProgramRegistrationsService,
    );
  });

  it('rejects fewer than two IDs', async () => {
    await expect(service.compareSurveysForAdmin(['only-one'])).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('rejects more than three IDs', async () => {
    await expect(
      service.compareSurveysForAdmin(['a', 'b', 'c', 'd']),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('builds side-by-side completion, ease, NPS, and shared questions', async () => {
    const spy = jest
      .spyOn(service, 'getResponseAnalyticsForAdmin')
      .mockImplementation(async (id: string) => {
        if (id === 's1') {
          return analyticsFixture({
            id: 's1',
            title: 'Feedback A',
            programTitle: 'Webinar A',
            meanEase: 4.2,
            nps: 50,
            mean: 4.5,
          }) as never;
        }
        return analyticsFixture({
          id: 's2',
          title: 'Feedback B',
          programTitle: 'Webinar B',
          meanEase: 3.8,
          nps: 20,
          mean: 3.9,
        }) as never;
      });

    const result = await service.compareSurveysForAdmin(['s1', 's2']);

    expect(result.columns).toHaveLength(2);
    expect(result.columns[0].averageEase).toBe(4.2);
    expect(result.columns[1].nps?.score).toBe(20);
    expect(result.columns[0].completionRate?.rate).toBe(50);
    expect(result.sharedQuestions).toHaveLength(1);
    expect(result.sharedQuestions[0].prompt).toBe('How satisfied were you?');
    expect(result.sharedQuestions[0].values[0].mean).toBe(4.5);
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it('rejects non-FEEDBACK surveys', async () => {
    jest.spyOn(service, 'getResponseAnalyticsForAdmin').mockResolvedValue({
      ...analyticsFixture({
        id: 's1',
        title: 'Intake',
        programTitle: 'P',
      }),
      survey: {
        id: 's1',
        title: 'Intake',
        type: SurveyType.INTAKE,
        program: { id: 'p1', title: 'P' },
      },
    } as never);

    await expect(
      service.compareSurveysForAdmin(['s1', 's2']),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
