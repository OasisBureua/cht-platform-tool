import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SurveyType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { QueueService } from '../../queue/queue.service';
import { OutboundSyncService } from '../outbound-sync/outbound-sync.service';
import { JotformService } from '../jotform/jotform.service';
import { FormJotformProgressService } from '../programs/form-jotform-progress.service';
import { ProgramRegistrationsService } from '../programs/program-registrations.service';
import { SurveysService } from './surveys.service';

describe('SurveysService.cloneSurveyOntoProgram', () => {
  const sourceQuestions = {
    version: 1,
    sections: [
      {
        id: 's1',
        title: 'Section',
        questions: [
          {
            id: 'q1',
            type: 'single_choice',
            prompt: 'Years in practice',
            required: true,
            options: ['0-5', '6-10'],
          },
        ],
      },
    ],
  };

  let prisma: {
    program: { findUnique: jest.Mock; update: jest.Mock };
    survey: {
      findUnique: jest.Mock;
      findFirst: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
    surveyResponse: { count: jest.Mock };
  };
  let service: SurveysService;

  beforeEach(() => {
    prisma = {
      program: {
        findUnique: jest.fn().mockResolvedValue({ id: 'prog-new', title: 'DB09 New' }),
        update: jest.fn().mockResolvedValue({}),
      },
      survey: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'src-1',
          programId: 'prog-old',
          title: 'DB09 Old - Registration',
          description: 'Custom intake',
          questions: sourceQuestions,
          type: SurveyType.INTAKE,
          required: true,
          isCustomized: true,
          schemaVersion: 3,
          jotformFormId: null,
        }),
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockImplementation(async ({ data }) => ({
          id: 'created-1',
          ...data,
        })),
        update: jest.fn(),
      },
      surveyResponse: { count: jest.fn().mockResolvedValue(0) },
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

  it('creates a cloned survey when the program has none of that type', async () => {
    const result = await service.cloneSurveyOntoProgram('prog-new', 'src-1');

    expect(result).toEqual({
      surveyId: 'created-1',
      type: SurveyType.INTAKE,
      created: true,
      replaced: false,
    });
    expect(prisma.survey.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          programId: 'prog-new',
          type: SurveyType.INTAKE,
          isCustomized: true,
          schemaVersion: 3,
          title: 'DB09 New - Registration',
        }),
      }),
    );
  });

  it('replaces an empty existing survey of the same type', async () => {
    prisma.survey.findFirst.mockResolvedValue({
      id: 'existing-1',
      type: SurveyType.INTAKE,
    });
    prisma.survey.update.mockResolvedValue({
      id: 'existing-1',
      type: SurveyType.INTAKE,
    });

    const result = await service.cloneSurveyOntoProgram('prog-new', 'src-1');

    expect(result.replaced).toBe(true);
    expect(result.created).toBe(false);
    expect(prisma.survey.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'existing-1' },
        data: expect.objectContaining({ isCustomized: true, schemaVersion: 3 }),
      }),
    );
  });

  it('refuses to overwrite a survey that already has responses', async () => {
    prisma.survey.findFirst.mockResolvedValue({
      id: 'existing-1',
      type: SurveyType.INTAKE,
    });
    prisma.surveyResponse.count.mockResolvedValue(4);

    await expect(
      service.cloneSurveyOntoProgram('prog-new', 'src-1'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects unknown source surveys', async () => {
    prisma.survey.findUnique.mockResolvedValue(null);
    await expect(
      service.cloneSurveyOntoProgram('prog-new', 'missing'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
