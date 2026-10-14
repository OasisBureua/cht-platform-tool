import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ProgramStatus, SurveyType } from '@prisma/client';
import { randomBytes, randomUUID } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { RecaptchaService } from '../../auth/recaptcha.service';
import { SesEmailService } from '../email/ses-email.service';
import { hasNativeSurveySchema } from '../../utils/survey-schema';
import { validatePublicSurveyAnswers } from './public-survey-answers';
import type { PublicRegisterDto } from './dto/public-registration.dto';

/**
 * Public registration (no account, no approval): someone enters their name
 * and email on a program's public page and is emailed a personal link to the
 * program's registration survey. Responses are stored without a user and are
 * kept out of HubSpot and the HCP roster (nothing here calls outbound sync).
 */
@Injectable()
export class PublicRegistrationService {
  private readonly logger = new Logger(PublicRegistrationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly recaptcha: RecaptchaService,
    private readonly email: SesEmailService,
  ) {}

  /** The program's registration survey: its newest INTAKE survey, as everywhere else. */
  private registrationSurvey(programId: string) {
    return this.prisma.survey.findFirst({
      where: { programId, type: SurveyType.INTAKE },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        title: true,
        description: true,
        questions: true,
        schemaVersion: true,
      },
    });
  }

  /** A published program with public registration on and a native registration survey. */
  private async openProgram(programId: string) {
    const program = await this.prisma.program.findUnique({
      where: { id: programId },
      select: {
        id: true,
        title: true,
        description: true,
        sponsorName: true,
        startDate: true,
        sessionHeroImageUrl: true,
        status: true,
        publicRegistrationEnabled: true,
      },
    });
    if (
      !program ||
      program.status !== ProgramStatus.PUBLISHED ||
      !program.publicRegistrationEnabled
    ) {
      throw new NotFoundException('Registration is not open for this program.');
    }
    const survey = await this.registrationSurvey(program.id);
    if (!survey || !hasNativeSurveySchema(survey.questions)) {
      throw new NotFoundException('Registration is not open for this program.');
    }
    return { program, survey };
  }

  async getProgram(programId: string) {
    const { program } = await this.openProgram(programId);
    return {
      id: program.id,
      title: program.title,
      description: program.description,
      sponsorName: program.sponsorName,
      startDate: program.startDate?.toISOString() ?? null,
      heroImageUrl: program.sessionHeroImageUrl ?? null,
    };
  }

  /**
   * Register (or re-register) and email the survey link. Registering again
   * with the same email re-sends the same link. The reply never says whether
   * the email was already registered.
   */
  async register(
    programId: string,
    dto: PublicRegisterDto,
    remoteIp?: string,
  ): Promise<{ ok: true }> {
    const captcha = await this.recaptcha.verify(
      dto.recaptchaToken,
      'public_registration',
      remoteIp,
    );
    if ('error' in captcha) throw new BadRequestException(captcha.error);

    const { program } = await this.openProgram(programId);
    const email = dto.email.trim().toLowerCase();
    const firstName = dto.firstName.trim();
    const lastName = dto.lastName.trim();
    if (!firstName || !lastName)
      throw new BadRequestException('First and last name are required.');

    const registration = await this.prisma.publicRegistration.upsert({
      where: { programId_email: { programId: program.id, email } },
      create: {
        programId: program.id,
        email,
        firstName,
        lastName,
        token: randomBytes(32).toString('base64url'),
      },
      update: { firstName, lastName },
    });

    try {
      const sent = await this.email.sendPublicRegistrationSurveyEmail({
        to: email,
        firstName,
        program: {
          id: program.id,
          title: program.title,
          sponsorName: program.sponsorName,
        },
        token: registration.token,
      });
      if (sent) {
        await this.prisma.publicRegistration.update({
          where: { id: registration.id },
          data: { emailSentAt: new Date() },
        });
      }
    } catch (err) {
      this.logger.warn(
        `Public registration ${registration.id}: survey email failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      throw new ServiceUnavailableException(
        'We could not send the email. Please try again in a few minutes.',
      );
    }
    this.logger.log(
      `Public registration ${registration.id} for program ${program.id}`,
    );
    return { ok: true };
  }

  private async byToken(token: string) {
    const registration = token?.trim()
      ? await this.prisma.publicRegistration.findUnique({
          where: { token: token.trim() },
        })
      : null;
    if (!registration) throw new NotFoundException('This link is not valid.');
    const { program, survey } = await this.openProgram(registration.programId);
    return { registration, program, survey };
  }

  /** The survey behind an emailed link. */
  async getSurvey(token: string) {
    const { registration, program, survey } = await this.byToken(token);
    return {
      program: {
        id: program.id,
        title: program.title,
        sponsorName: program.sponsorName,
      },
      survey: {
        id: survey.id,
        title: survey.title,
        description: survey.description,
        questions: survey.questions,
      },
      registrant: { firstName: registration.firstName },
      submittedAt: registration.submittedAt?.toISOString() ?? null,
    };
  }

  /** Submit the registration survey once, through the emailed link. */
  async submit(
    token: string,
    rawAnswers: unknown,
  ): Promise<{ submittedAt: string }> {
    const { registration, survey } = await this.byToken(token);
    if (registration.submittedAt) {
      throw new ConflictException('This survey has already been submitted.');
    }
    const checked = validatePublicSurveyAnswers(survey.questions, rawAnswers);
    if ('errors' in checked) {
      throw new BadRequestException(checked.errors.join(' '));
    }

    const submittedAt = new Date();
    try {
      await this.prisma.$transaction([
        this.prisma.surveyResponse.create({
          data: {
            surveyId: survey.id,
            userId: null,
            publicRegistrationId: registration.id,
            answers: checked.answers as object,
            schemaVersion: survey.schemaVersion,
            submissionId: randomUUID(),
            submittedAt,
          },
        }),
        this.prisma.publicRegistration.update({
          where: { id: registration.id },
          data: { submittedAt },
        }),
      ]);
    } catch (err) {
      // Unique publicRegistrationId: a second submit racing the first.
      if ((err as { code?: string }).code === 'P2002') {
        throw new ConflictException('This survey has already been submitted.');
      }
      throw err;
    }
    this.logger.log(
      `Public registration ${registration.id} submitted survey ${survey.id}`,
    );
    return { submittedAt: submittedAt.toISOString() };
  }
}
