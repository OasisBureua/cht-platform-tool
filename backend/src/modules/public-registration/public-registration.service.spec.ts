import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { PrismaService } from '../../prisma/prisma.service';
import type { RecaptchaService } from '../../auth/recaptcha.service';
import type { SesEmailService } from '../email/ses-email.service';
import { PublicRegistrationService } from './public-registration.service';
import { validatePublicSurveyAnswers } from './public-survey-answers';

const schema = {
  version: 3,
  sections: [
    {
      id: 'main',
      title: 'Questions',
      questions: [
        { id: 'intro', type: 'info', prompt: 'Welcome' },
        {
          id: 'role',
          type: 'single_choice',
          prompt: 'Your role',
          required: true,
          options: ['Physician', 'Other'],
          followUp: {
            whenOption: 'Other',
            question: {
              id: 'role_other',
              type: 'text',
              prompt: 'Describe',
              required: true,
            },
          },
        },
        {
          id: 'topics',
          type: 'multi_choice',
          prompt: 'Topics',
          required: false,
          maxSelections: 2,
          options: ['A', 'B', 'C'],
        },
        {
          id: 'score',
          type: 'rating',
          prompt: 'Rate',
          required: false,
          scaleMin: 1,
          scaleMax: 5,
        },
        { id: 'notes', type: 'long_text', prompt: 'Notes', required: true },
      ],
    },
  ],
};

describe('validatePublicSurveyAnswers', () => {
  it('keeps valid answers, drops unknown keys, info blocks and identity fields', () => {
    const result = validatePublicSurveyAnswers(schema, {
      role: 'Physician',
      topics: ['A', 'C'],
      score: '4',
      notes: '  Looking forward to it ',
      intro: 'x',
      unknown: 'dropped',
      email: 'me@example.com',
    });
    expect(result).toEqual({
      answers: {
        role: 'Physician',
        topics: ['A', 'C'],
        score: 4,
        notes: 'Looking forward to it',
      },
    });
  });

  it('lists every problem: missing required, options outside the list, too many choices, out-of-scale rating', () => {
    const result = validatePublicSurveyAnswers(schema, {
      role: 'Nurse',
      topics: ['A', 'B', 'C'],
      score: 9,
    });
    expect('errors' in result && result.errors).toEqual([
      '"Your role": choose one of the listed options.',
      '"Topics": choose at most 2.',
      '"Rate": enter a value in the scale.',
      '"Notes" is required.',
    ]);
  });

  it('does not require a follow-up question that was not triggered', () => {
    expect(
      validatePublicSurveyAnswers(schema, { role: 'Physician', notes: 'ok' }),
    ).toEqual({
      answers: { role: 'Physician', notes: 'ok' },
    });
  });

  it('rejects text over the length limit and non-object answers', () => {
    expect(
      'errors' in
        validatePublicSurveyAnswers(schema, {
          role: 'Physician',
          notes: 'x'.repeat(5001),
        }),
    ).toBe(true);
    expect(validatePublicSurveyAnswers(schema, ['a'])).toEqual({
      errors: ['Answers must be an object.'],
    });
  });
});

describe('PublicRegistrationService', () => {
  const program = {
    id: 'prog-1',
    title: 'CHM User Test',
    description: 'd',
    sponsorName: 'CHM',
    startDate: null,
    sessionHeroImageUrl: null,
    status: 'PUBLISHED',
    publicRegistrationEnabled: true,
  };
  const survey = {
    id: 'survey-1',
    title: 'Registration',
    description: null,
    questions: schema,
    schemaVersion: 3,
  };
  let prisma: {
    program: { findUnique: jest.Mock };
    survey: { findFirst: jest.Mock };
    publicRegistration: {
      upsert: jest.Mock;
      update: jest.Mock;
      findUnique: jest.Mock;
    };
    surveyResponse: { create: jest.Mock };
    $transaction: jest.Mock;
  };
  let recaptcha: { verify: jest.Mock };
  let email: { sendPublicRegistrationSurveyEmail: jest.Mock };
  let service: PublicRegistrationService;

  beforeEach(() => {
    prisma = {
      program: { findUnique: jest.fn().mockResolvedValue(program) },
      survey: { findFirst: jest.fn().mockResolvedValue(survey) },
      publicRegistration: {
        upsert: jest.fn().mockResolvedValue({ id: 'reg-1', token: 'tok-1' }),
        update: jest.fn((args: unknown) => args),
        findUnique: jest.fn(),
      },
      surveyResponse: { create: jest.fn((args: unknown) => args) },
      $transaction: jest.fn().mockResolvedValue([]),
    };
    recaptcha = { verify: jest.fn().mockResolvedValue({ ok: true }) };
    email = {
      sendPublicRegistrationSurveyEmail: jest.fn().mockResolvedValue(true),
    };
    service = new PublicRegistrationService(
      prisma as unknown as PrismaService,
      recaptcha as unknown as RecaptchaService,
      email as unknown as SesEmailService,
    );
  });

  describe('register', () => {
    const dto = {
      firstName: ' Ana ',
      lastName: 'Ruiz',
      email: ' Ana@Example.COM ',
      recaptchaToken: 'cap',
    };

    it('registers without approval and emails the personal survey link', async () => {
      await expect(service.register('prog-1', dto, '1.2.3.4')).resolves.toEqual(
        { ok: true },
      );
      expect(recaptcha.verify).toHaveBeenCalledWith(
        'cap',
        'public_registration',
        '1.2.3.4',
      );
      expect(prisma.publicRegistration.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            programId_email: { programId: 'prog-1', email: 'ana@example.com' },
          },
          create: expect.objectContaining({
            email: 'ana@example.com',
            firstName: 'Ana',
            lastName: 'Ruiz',
            token: expect.any(String),
          }),
          update: { firstName: 'Ana', lastName: 'Ruiz' },
        }),
      );
      expect(email.sendPublicRegistrationSurveyEmail).toHaveBeenCalledWith({
        to: 'ana@example.com',
        firstName: 'Ana',
        program: { id: 'prog-1', title: 'CHM User Test', sponsorName: 'CHM' },
        token: 'tok-1',
      });
      expect(prisma.publicRegistration.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'reg-1' },
          data: { emailSentAt: expect.any(Date) },
        }),
      );
    });

    it('generates an unguessable token', async () => {
      await service.register('prog-1', dto);
      const token = prisma.publicRegistration.upsert.mock.calls[0][0].create
        .token as string;
      expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    });

    it('stops on a failed captcha before touching the database', async () => {
      recaptcha.verify.mockResolvedValue({
        error: 'Captcha verification failed. Please try again.',
      });
      await expect(service.register('prog-1', dto)).rejects.toThrow(
        BadRequestException,
      );
      expect(prisma.publicRegistration.upsert).not.toHaveBeenCalled();
    });

    it.each([
      [
        'public registration is off',
        { ...program, publicRegistrationEnabled: false },
        survey,
      ],
      ['the program is not published', { ...program, status: 'DRAFT' }, survey],
      ['there is no registration survey', program, null],
      [
        'the registration survey is not native',
        program,
        { ...survey, questions: { source: 'jotform' } },
      ],
    ])('is closed when %s', async (_why, p, s) => {
      prisma.program.findUnique.mockResolvedValue(p);
      prisma.survey.findFirst.mockResolvedValue(s);
      await expect(service.register('prog-1', dto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('asks the person to retry when the email cannot be sent', async () => {
      email.sendPublicRegistrationSurveyEmail.mockRejectedValue(
        new Error('SES down'),
      );
      await expect(service.register('prog-1', dto)).rejects.toThrow(
        ServiceUnavailableException,
      );
    });
  });

  describe('survey link', () => {
    const registration = {
      id: 'reg-1',
      programId: 'prog-1',
      firstName: 'Ana',
      token: 'tok-1',
      submittedAt: null,
    };

    it('returns the program registration survey for a valid token', async () => {
      prisma.publicRegistration.findUnique.mockResolvedValue(registration);
      await expect(service.getSurvey('tok-1')).resolves.toEqual({
        program: { id: 'prog-1', title: 'CHM User Test', sponsorName: 'CHM' },
        survey: {
          id: 'survey-1',
          title: 'Registration',
          description: null,
          questions: schema,
        },
        registrant: { firstName: 'Ana' },
        submittedAt: null,
      });
    });

    it('rejects an unknown token', async () => {
      prisma.publicRegistration.findUnique.mockResolvedValue(null);
      await expect(service.getSurvey('nope')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('stores the response without a user, tied to the registration', async () => {
      prisma.publicRegistration.findUnique.mockResolvedValue(registration);
      await service.submit('tok-1', { role: 'Physician', notes: 'hi' });
      expect(prisma.surveyResponse.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          surveyId: 'survey-1',
          userId: null,
          publicRegistrationId: 'reg-1',
          answers: { role: 'Physician', notes: 'hi' },
          schemaVersion: 3,
          submissionId: expect.any(String),
        }),
      });
      expect(prisma.publicRegistration.update).toHaveBeenCalledWith({
        where: { id: 'reg-1' },
        data: { submittedAt: expect.any(Date) },
      });
      expect(prisma.$transaction).toHaveBeenCalled();
    });

    it('accepts one submission per registration', async () => {
      prisma.publicRegistration.findUnique.mockResolvedValue({
        ...registration,
        submittedAt: new Date(),
      });
      await expect(
        service.submit('tok-1', { role: 'Physician', notes: 'hi' }),
      ).rejects.toThrow(ConflictException);

      prisma.publicRegistration.findUnique.mockResolvedValue(registration);
      prisma.$transaction.mockRejectedValue(
        Object.assign(new Error('unique'), { code: 'P2002' }),
      );
      await expect(
        service.submit('tok-1', { role: 'Physician', notes: 'hi' }),
      ).rejects.toThrow(ConflictException);
    });

    it('rejects invalid answers with the reasons', async () => {
      prisma.publicRegistration.findUnique.mockResolvedValue(registration);
      await expect(service.submit('tok-1', { role: 'Nurse' })).rejects.toThrow(
        '"Your role": choose one of the listed options. "Notes" is required.',
      );
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });
  });
});
