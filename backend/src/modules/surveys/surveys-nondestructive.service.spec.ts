import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { QueueService } from '../../queue/queue.service';
import { OutboundSyncService } from '../outbound-sync/outbound-sync.service';
import { JotformService } from '../jotform/jotform.service';
import { FormJotformProgressService } from '../programs/form-jotform-progress.service';
import { ProgramRegistrationsService } from '../programs/program-registrations.service';
import { defaultPostEventFeedbackQuestions } from './native-survey-templates';
import { SurveysService } from './surveys.service';

const existingSchema = {
  version: 1,
  sections: [
    {
      id: 'main',
      title: 'Questions',
      questions: [
        {
          id: 'q1',
          type: 'single_choice',
          prompt: 'Original prompt',
          options: ['Yes', 'No'],
          required: true,
        },
      ],
    },
  ],
};

describe('SurveysService non-destructive native survey lifecycle', () => {
  let service: SurveysService;
  let prisma: {
    program: {
      findUnique: jest.Mock;
      update: jest.Mock;
    };
    survey: {
      findMany: jest.Mock;
      findFirst: jest.Mock;
      findUnique: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
      deleteMany: jest.Mock;
    };
  };

  beforeEach(() => {
    prisma = {
      program: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'program-1',
          title: 'Program One',
        }),
        update: jest.fn(),
      },
      survey: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        deleteMany: jest.fn(),
      },
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

  it('keeps an existing customized survey id and only creates the missing pair member', async () => {
    const intake = {
      id: 'intake-existing',
      programId: 'program-1',
      type: 'INTAKE',
      isCustomized: true,
      questions: existingSchema,
      createdAt: new Date('2026-01-01'),
    };
    const feedback = {
      id: 'feedback-new',
      programId: 'program-1',
      type: 'FEEDBACK',
      isCustomized: false,
      createdAt: new Date('2026-07-21'),
    };
    prisma.survey.findMany.mockResolvedValue([intake]);
    prisma.survey.create.mockResolvedValue(feedback);

    const result = await service.ensureNativeSurveyPairForProgram(
      'program-1',
      'Program One',
    );

    expect(result).toEqual({
      intakeSurveyId: 'intake-existing',
      feedbackSurveyId: 'feedback-new',
    });
    expect(prisma.survey.create).toHaveBeenCalledTimes(1);
    expect(prisma.survey.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        programId: 'program-1',
        title: 'Program One - Post Event Survey',
        description: 'Post-webinar feedback',
        type: 'FEEDBACK',
        required: true,
        jotformFormId: null,
        isCustomized: false,
        schemaVersion: 1,
      }),
    });
    const createdQuestions = (
      prisma.survey.create.mock.calls[0][0] as {
        data: { questions: { version: number } };
      }
    ).data.questions;
    expect(createdQuestions.version).toBe(1);
    expect(prisma.survey.deleteMany).not.toHaveBeenCalled();
    expect(prisma.survey.update).not.toHaveBeenCalled();
    expect(prisma.program.update).toHaveBeenCalledWith({
      where: { id: 'program-1' },
      data: { jotformSurveyUrl: null },
    });
  });

  it('is idempotent when both survey types already exist', async () => {
    prisma.survey.findMany.mockResolvedValue([
      { id: 'intake-1', type: 'INTAKE', createdAt: new Date() },
      { id: 'feedback-1', type: 'FEEDBACK', createdAt: new Date() },
    ]);

    await expect(
      service.ensureNativeSurveyPairForProgram('program-1', 'Program One'),
    ).resolves.toEqual({
      intakeSurveyId: 'intake-1',
      feedbackSurveyId: 'feedback-1',
    });
    expect(prisma.survey.create).not.toHaveBeenCalled();
    expect(prisma.survey.deleteMany).not.toHaveBeenCalled();
    expect(prisma.program.update).not.toHaveBeenCalled();
  });

  it('allows adding a new question after responses exist and marks customized', async () => {
    prisma.survey.findUnique.mockResolvedValue({
      id: 'survey-1',
      type: 'INTAKE',
      programId: 'program-1',
      questions: existingSchema,
      schemaVersion: 1,
      _count: { responses: 2 },
    });
    prisma.survey.update.mockImplementation(
      ({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve({ id: 'survey-1', ...data }),
    );
    const next = {
      ...existingSchema,
      sections: [
        {
          ...existingSchema.sections[0],
          questions: [
            ...existingSchema.sections[0].questions,
            {
              id: 'q2',
              type: 'text',
              prompt: 'New question',
              required: false,
            },
          ],
        },
      ],
    };

    await service.updateSurvey('survey-1', {
      questions: next,
      required: true,
    });

    expect(prisma.survey.update).toHaveBeenCalledWith({
      where: { id: 'survey-1' },
      data: {
        questions: {
          ...next,
          version: 2,
        },
        jotformFormId: null,
        schemaVersion: 2,
        required: true,
        isCustomized: true,
      },
    });
  });

  it('blocks reinterpreting an existing answer key after responses exist', async () => {
    prisma.survey.findUnique.mockResolvedValue({
      id: 'survey-1',
      type: 'INTAKE',
      programId: 'program-1',
      questions: existingSchema,
      schemaVersion: 1,
      _count: { responses: 1 },
    });
    const changed = {
      ...existingSchema,
      sections: [
        {
          ...existingSchema.sections[0],
          questions: [
            {
              ...existingSchema.sections[0].questions[0],
              prompt: 'Changed prompt',
            },
          ],
        },
      ],
    };

    await expect(
      service.updateSurvey('survey-1', { questions: changed }),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.survey.update).not.toHaveBeenCalled();
  });

  it('blocks deleting a survey that has collected responses', async () => {
    prisma.survey.findUnique.mockResolvedValue({
      id: 'survey-1',
      title: 'Survey',
      _count: { responses: 3 },
    });

    await expect(service.deleteSurvey('survey-1')).rejects.toThrow(
      'Survey cannot be deleted because it has 3 response(s).',
    );
    expect(prisma.survey.delete).not.toHaveBeenCalled();
  });

  it('blocks legacy Jotform conversion when the survey has responses', async () => {
    prisma.survey.findFirst.mockResolvedValue({
      id: 'feedback-1',
      _count: { responses: 1 },
    });

    await expect(
      service.applyManualPostEventJotform(
        'program-1',
        'Program One',
        '123456789012345',
      ),
    ).rejects.toThrow('already has responses');
    expect(prisma.survey.deleteMany).not.toHaveBeenCalled();
    expect(prisma.survey.update).not.toHaveBeenCalled();
  });
});
