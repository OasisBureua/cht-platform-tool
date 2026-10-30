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

describe('SurveysService.listCompareCandidatesForAdmin', () => {
  let service: SurveysService;
  let prisma: {
    survey: { count: jest.Mock; findMany: jest.Mock };
  };

  beforeEach(() => {
    prisma = {
      survey: { count: jest.fn(), findMany: jest.fn() },
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

  it('searches FEEDBACK surveys by title / program title and pins includeIds', async () => {
    prisma.survey.count.mockResolvedValue(12);
    prisma.survey.findMany
      .mockResolvedValueOnce([
        {
          id: 's2',
          title: 'Feedback B',
          type: SurveyType.FEEDBACK,
          isCustomized: false,
          program: { id: 'p2', title: 'Webinar Two' },
          _count: { responses: 5 },
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 's1',
          title: 'Feedback A',
          type: SurveyType.FEEDBACK,
          isCustomized: true,
          program: { id: 'p1', title: 'Webinar One' },
          _count: { responses: 3 },
        },
      ]);

    const result = await service.listCompareCandidatesForAdmin({
      q: 'Webinar',
      limit: 50,
      includeIds: ['s1'],
    });

    expect(prisma.survey.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          type: SurveyType.FEEDBACK,
          OR: expect.any(Array),
        }),
      }),
    );
    expect(result.totalMatching).toBe(12);
    expect(result.items[0].id).toBe('s1');
    expect(result.items.map((i) => i.id)).toEqual(['s1', 's2']);
  });
});
