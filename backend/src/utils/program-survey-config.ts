import { ProgramZoomSessionType, SurveyType } from '@prisma/client';
import { surveyQuestionsAreNative } from './native-survey-questions';

/** Learners may complete post-event FEEDBACK surveys within this window after the session unlocks. */
export const POST_EVENT_SURVEY_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

type PostEventUnlockProgram = {
  zoomSessionType?: ProgramZoomSessionType | null;
  startDate?: Date | null;
  duration?: number | null;
  zoomSessionEndedAt?: Date | null;
};

/**
 * When the post-event survey becomes available (session ended or scheduled end).
 * Office-hours MEETING without schedule unlocks immediately (null → treat as epoch).
 */
export function getPostEventSurveyUnlockAt(
  program: PostEventUnlockProgram,
): Date | null {
  if (program.zoomSessionEndedAt) {
    return program.zoomSessionEndedAt;
  }
  if (program.zoomSessionType === ProgramZoomSessionType.MEETING) {
    return new Date(0);
  }
  if (!program.startDate) {
    return null;
  }
  const durMin = program.duration ?? 60;
  return new Date(program.startDate.getTime() + durMin * 60_000);
}

export function isPostEventSurveyWithinWindow(
  unlockAt: Date | null,
  nowMs: number = Date.now(),
): boolean {
  if (!unlockAt) {
    return false;
  }
  const unlockMs = unlockAt.getTime();
  if (nowMs < unlockMs) {
    return false;
  }
  return nowMs < unlockMs + POST_EVENT_SURVEY_WINDOW_MS;
}

export type ProgramSurveyMeta = {
  hasPostEventSurvey: boolean;
  hasIntakeSurvey: boolean;
  feedbackSurveyId?: string;
  intakeSurveyId?: string;
  /** True when FEEDBACK survey row is tied to a Jotform form id. */
  feedbackUsesJotform: boolean;
  /** True when intake is served via Jotform URL (no native INTAKE survey row). */
  intakeUsesJotform: boolean;
};

type SurveyRow = {
  id: string;
  jotformFormId: string | null;
  questions: unknown;
};

type SurveyLookup = {
  findFirst(args: {
    where: { programId: string; type: SurveyType };
    orderBy: { createdAt: 'desc' };
    select: { id: true; jotformFormId: true; questions: true };
  }): Promise<SurveyRow | null>;
};

export async function programHasPostEventSurvey(
  prisma: {
    survey: {
      count(args: {
        where: { programId: string; type: SurveyType };
      }): Promise<number>;
    };
  },
  programId: string,
  jotformSurveyUrl?: string | null,
): Promise<boolean> {
  if (jotformSurveyUrl?.trim()) return true;
  const feedbackCount = await prisma.survey.count({
    where: { programId, type: SurveyType.FEEDBACK },
  });
  return feedbackCount > 0;
}

export async function loadProgramSurveyMeta(
  prisma: { survey: SurveyLookup },
  program: {
    id: string;
    jotformSurveyUrl?: string | null;
    jotformIntakeFormUrl?: string | null;
    zoomSessionType: ProgramZoomSessionType;
  },
  _defaultIntakeUrl?: string,
): Promise<ProgramSurveyMeta> {
  const [feedback, intake] = await Promise.all([
    prisma.survey.findFirst({
      where: { programId: program.id, type: SurveyType.FEEDBACK },
      orderBy: { createdAt: 'desc' },
      select: { id: true, jotformFormId: true, questions: true },
    }),
    prisma.survey.findFirst({
      where: { programId: program.id, type: SurveyType.INTAKE },
      orderBy: { createdAt: 'desc' },
      select: { id: true, jotformFormId: true, questions: true },
    }),
  ]);

  const hasJotformPostEventUrl = !!program.jotformSurveyUrl?.trim();
  const hasFeedbackSurvey = !!feedback;

  const feedbackNative =
    hasFeedbackSurvey && surveyQuestionsAreNative(feedback?.questions);

  return {
    hasPostEventSurvey: hasJotformPostEventUrl || hasFeedbackSurvey,
    // Registration / learner intake is native-survey only (no Jotform).
    hasIntakeSurvey: !!intake,
    feedbackSurveyId: feedback?.id,
    intakeSurveyId: intake?.id,
    feedbackUsesJotform:
      hasFeedbackSurvey &&
      !!feedback?.jotformFormId?.trim() &&
      !feedbackNative,
    intakeUsesJotform: false,
  };
}

export function registrationHasIntakeSubmission(reg: {
  intakeSubmissionId?: string | null;
}): boolean {
  return !!reg.intakeSubmissionId?.trim();
}

export async function userHasIntakeSurveyResponse(
  prisma: {
    surveyResponse: {
      findUnique(args: {
        where: { userId_surveyId: { userId: string; surveyId: string } };
      }): Promise<{ id: string } | null>;
    };
  },
  userId: string,
  intakeSurveyId?: string,
  reg?: { intakeSubmissionId?: string | null },
): Promise<boolean> {
  if (reg && registrationHasIntakeSubmission(reg)) return true;
  if (!intakeSurveyId) return false;
  const row = await prisma.surveyResponse.findUnique({
    where: { userId_surveyId: { userId, surveyId: intakeSurveyId } },
  });
  return !!row;
}

export async function userHasPostEventSurveyResponse(
  prisma: {
    surveyResponse: {
      findUnique(args: {
        where: { userId_surveyId: { userId: string; surveyId: string } };
      }): Promise<{ id: string } | null>;
    };
  },
  userId: string,
  feedbackSurveyId?: string,
): Promise<boolean> {
  if (!feedbackSurveyId) return false;
  const row = await prisma.surveyResponse.findUnique({
    where: { userId_surveyId: { userId, surveyId: feedbackSurveyId } },
  });
  return !!row;
}
