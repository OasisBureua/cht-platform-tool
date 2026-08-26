import { ConfigService } from '@nestjs/config';
import {
  ProgramRegistrationStatus,
  SurveyType,
  type Prisma,
} from '@prisma/client';
import { SurveysService } from './surveys.service';
import { PrismaService } from '../../prisma/prisma.service';
import { QueueService } from '../../queue/queue.service';
import { OutboundSyncService } from '../outbound-sync/outbound-sync.service';
import { JotformService } from '../jotform/jotform.service';
import { FormJotformProgressService } from '../programs/form-jotform-progress.service';
import { ProgramRegistrationsService } from '../programs/program-registrations.service';

const nativeSchema = {
  sections: [
    {
      id: 's1',
      questions: [
        {
          id: 'role',
          type: 'single_choice',
          prompt: 'Your role?',
          options: ['MD', 'NP'],
        },
        {
          id: 'comments',
          type: 'long_text',
          prompt: 'Anything else?',
        },
      ],
    },
  ],
};

function makeResponse(over: {
  id: string;
  userId: string;
  submittedAt: string;
  score?: number | null;
  answers?: Prisma.JsonValue;
}) {
  return {
    id: over.id,
    submissionId: `sub-${over.id}`,
    userId: over.userId,
    submittedAt: new Date(over.submittedAt),
    score: over.score ?? null,
    answers: over.answers ?? { role: 'MD' },
    user: {
      id: over.userId,
      email: `${over.userId}@example.com`,
      firstName: 'F',
      lastName: 'L',
      specialty: 'Cardiology',
    },
  };
}

describe('SurveysService.getResponseAnalyticsForAdmin', () => {
  let service: SurveysService;
  let prisma: {
    survey: { findUnique: jest.Mock };
    surveyResponse: { findMany: jest.Mock };
    programRegistration: { findMany: jest.Mock; count: jest.Mock };
  };

  beforeEach(() => {
    prisma = {
      survey: { findUnique: jest.fn() },
      surveyResponse: { findMany: jest.fn() },
      programRegistration: { findMany: jest.fn(), count: jest.fn() },
    };

    service = new SurveysService(
      prisma as unknown as PrismaService,
      {} as QueueService,
      { get: jest.fn() } as unknown as ConfigService,
      {} as OutboundSyncService,
      {} as JotformService,
      {} as FormJotformProgressService,
      {} as ProgramRegistrationsService,
    );
  });

  function mockSurvey(
    over: Partial<{
      type: SurveyType;
      programId: string | null;
      program: { id: string; title: string } | null;
    }> = {},
  ) {
    prisma.survey.findUnique.mockResolvedValue({
      id: 'sv1',
      title: 'Post-event feedback',
      type: over.type ?? SurveyType.FEEDBACK,
      questions: nativeSchema,
      programId: 'programId' in over ? over.programId : 'prog1',
      program:
        'program' in over ? over.program : { id: 'prog1', title: 'Program' },
    });
    prisma.programRegistration.findMany.mockResolvedValue([]);
  }

  it('computes completion rate against APPROVED registrations for post-event surveys', async () => {
    mockSurvey({ type: SurveyType.FEEDBACK });
    prisma.surveyResponse.findMany.mockResolvedValue([
      makeResponse({
        id: 'r1',
        userId: 'u1',
        submittedAt: '2026-07-10T09:00:00.000Z',
      }),
      makeResponse({
        id: 'r2',
        userId: 'u2',
        submittedAt: '2026-07-11T09:00:00.000Z',
      }),
    ]);
    prisma.programRegistration.count.mockResolvedValue(4);

    const result = await service.getResponseAnalyticsForAdmin('sv1');

    expect(prisma.programRegistration.count).toHaveBeenCalledWith({
      where: { programId: 'prog1', status: ProgramRegistrationStatus.APPROVED },
    });
    expect(result.survey).toEqual({
      id: 'sv1',
      title: 'Post-event feedback',
      type: SurveyType.FEEDBACK,
      program: { id: 'prog1', title: 'Program' },
    });
    expect(result.analytics.totals.totalResponses).toBe(2);
    expect(result.analytics.totals.uniqueRespondents).toBe(2);
    expect(result.analytics.totals.completionRate).toEqual({
      eligible: 4,
      completed: 2,
      rate: 50,
    });
  });

  it('maps score + userId + answers into the aggregator', async () => {
    mockSurvey({ type: SurveyType.POST_TEST });
    prisma.surveyResponse.findMany.mockResolvedValue([
      makeResponse({
        id: 'r1',
        userId: 'u1',
        submittedAt: '2026-07-10T09:00:00.000Z',
        score: 80,
      }),
      makeResponse({
        id: 'r2',
        userId: 'u2',
        submittedAt: '2026-07-10T10:00:00.000Z',
        score: 100,
      }),
    ]);
    prisma.programRegistration.count.mockResolvedValue(2);

    const result = await service.getResponseAnalyticsForAdmin('sv1');

    expect(result.analytics.totals.score).toMatchObject({
      count: 2,
      mean: 90,
      min: 80,
      max: 100,
    });
    const role = result.analytics.questions.find((q) => q.id === 'role');
    expect(role?.kind).toBe('choice');
  });

  it('reports a null completion rate for INTAKE surveys (no eligible query)', async () => {
    mockSurvey({ type: SurveyType.INTAKE });
    prisma.surveyResponse.findMany.mockResolvedValue([
      makeResponse({
        id: 'r1',
        userId: 'u1',
        submittedAt: '2026-07-10T09:00:00.000Z',
      }),
    ]);

    const result = await service.getResponseAnalyticsForAdmin('sv1');

    expect(prisma.programRegistration.count).not.toHaveBeenCalled();
    expect(result.analytics.totals.completionRate).toBeNull();
  });

  it('reports a null completion rate when the survey has no program', async () => {
    mockSurvey({ type: SurveyType.FEEDBACK, programId: null, program: null });
    prisma.surveyResponse.findMany.mockResolvedValue([
      makeResponse({
        id: 'r1',
        userId: 'u1',
        submittedAt: '2026-07-10T09:00:00.000Z',
      }),
    ]);

    const result = await service.getResponseAnalyticsForAdmin('sv1');

    expect(prisma.programRegistration.count).not.toHaveBeenCalled();
    expect(result.analytics.totals.completionRate).toBeNull();
  });

  describe('free-text sample handling (BE-5)', () => {
    function findComments(result: {
      analytics: { questions: Array<{ id: string; samples?: string[] }> };
    }) {
      return result.analytics.questions.find((q) => q.id === 'comments');
    }

    beforeEach(() => {
      mockSurvey({ type: SurveyType.FEEDBACK });
      prisma.programRegistration.count.mockResolvedValue(2);
      prisma.surveyResponse.findMany.mockResolvedValue([
        makeResponse({
          id: 'r1',
          userId: 'u1',
          submittedAt: '2026-07-10T09:00:00.000Z',
          answers: { role: 'MD', comments: 'Loved it, email me at a@b.com' },
        }),
      ]);
    });

    it('omits samples by default (counts only)', async () => {
      const result = await service.getResponseAnalyticsForAdmin('sv1');
      const comments = findComments(result);
      expect(comments?.samples).toEqual([]);
    });

    it('emits redacted samples when includeTextSamples is true', async () => {
      const result = await service.getResponseAnalyticsForAdmin('sv1', {
        includeTextSamples: true,
      });
      const comments = findComments(result);
      expect(comments?.samples).toEqual([
        'Loved it, email me at [redacted-email]',
      ]);
    });
  });

  describe('segmentation (BE-6)', () => {
    it('returns no segments by default', async () => {
      mockSurvey({ type: SurveyType.FEEDBACK });
      prisma.programRegistration.count.mockResolvedValue(2);
      prisma.surveyResponse.findMany.mockResolvedValue([
        makeResponse({
          id: 'r1',
          userId: 'u1',
          submittedAt: '2026-07-10T09:00:00.000Z',
        }),
      ]);

      const result = await service.getResponseAnalyticsForAdmin('sv1');
      expect(result.analytics.segments).toBeNull();
    });

    it('maps user.specialty into a specialty breakdown', async () => {
      mockSurvey({ type: SurveyType.FEEDBACK });
      prisma.programRegistration.count.mockResolvedValue(2);
      prisma.surveyResponse.findMany.mockResolvedValue([
        makeResponse({
          id: 'r1',
          userId: 'u1',
          submittedAt: '2026-07-10T09:00:00.000Z',
        }),
        makeResponse({
          id: 'r2',
          userId: 'u2',
          submittedAt: '2026-07-10T10:00:00.000Z',
        }),
      ]);

      const result = await service.getResponseAnalyticsForAdmin('sv1', {
        segmentBy: 'specialty',
      });
      expect(result.analytics.segments?.dimension).toBe('specialty');
      // makeResponse defaults every user to specialty "Cardiology"
      expect(result.analytics.segments?.groups.map((g) => g.key)).toEqual([
        'Cardiology',
      ]);
      expect(result.analytics.segments?.groups[0].totalResponses).toBe(2);
    });

    it('maps registration.status into a status breakdown', async () => {
      mockSurvey({ type: SurveyType.FEEDBACK });
      prisma.programRegistration.count.mockResolvedValue(2);
      prisma.programRegistration.findMany.mockResolvedValue([
        {
          userId: 'u1',
          status: 'APPROVED',
          postEventAttendanceStatus: 'VERIFIED',
        },
        {
          userId: 'u2',
          status: 'PENDING',
          postEventAttendanceStatus: 'NOT_REQUIRED',
        },
      ]);
      prisma.surveyResponse.findMany.mockResolvedValue([
        makeResponse({
          id: 'r1',
          userId: 'u1',
          submittedAt: '2026-07-10T09:00:00.000Z',
        }),
        makeResponse({
          id: 'r2',
          userId: 'u2',
          submittedAt: '2026-07-10T10:00:00.000Z',
        }),
      ]);

      const result = await service.getResponseAnalyticsForAdmin('sv1', {
        segmentBy: 'status',
      });
      expect(result.analytics.segments?.dimension).toBe('status');
      expect(
        result.analytics.segments?.groups.map((g) => g.key).sort(),
      ).toEqual(['APPROVED', 'PENDING']);
    });
  });
});
