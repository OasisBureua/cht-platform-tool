import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AdminController } from './admin.controller';
import { ProgramsService } from '../programs/programs.service';
import { ProgramRegistrationsService } from '../programs/program-registrations.service';
import { SurveysService } from '../surveys/surveys.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ZoomService } from '../webinars/zoom.service';
import { SessionHeroPresignService } from './session-hero-presign.service';

describe('AdminController importZoomSession', () => {
  let controller: AdminController;
  let prisma: { program: { findFirst: jest.Mock } };
  let zoom: {
    isConfigured: jest.Mock;
    getWebinarById: jest.Mock;
    getMeetingById: jest.Mock;
  };
  let programsService: { createProgram: jest.Mock };
  let surveysService: { attachSurveysForNewWebinar: jest.Mock };

  beforeEach(() => {
    prisma = { program: { findFirst: jest.fn() } };
    zoom = {
      isConfigured: jest.fn().mockReturnValue(true),
      getWebinarById: jest.fn(),
      getMeetingById: jest.fn(),
    };
    programsService = { createProgram: jest.fn() };
    surveysService = {
      attachSurveysForNewWebinar: jest.fn().mockResolvedValue({
        intakeSurveyId: 'survey-intake-1',
        feedbackSurveyId: 'survey-feedback-1',
      }),
    };

    controller = new AdminController(
      programsService as unknown as ProgramsService,
      {} as ProgramRegistrationsService,
      surveysService as unknown as SurveysService,
      prisma as unknown as PrismaService,
      {} as ConfigService,
      {} as import('../../auth/auth.service').AuthService,
      zoom as unknown as ZoomService,
      {} as SessionHeroPresignService,
      {} as import('../email/ses-email.service').SesEmailService,
    );
  });

  it('requires Zoom API configuration', async () => {
    zoom.isConfigured.mockReturnValue(false);
    await expect(
      controller.importZoomSession({ zoomId: '81517150352' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('requires a zoomId', async () => {
    await expect(
      controller.importZoomSession({ zoomId: '  ' }),
    ).rejects.toThrow('zoomId is required');
  });

  it('returns conflict with existingProgramId when Zoom session is already linked', async () => {
    prisma.program.findFirst.mockResolvedValue({
      id: 'prog-existing',
      title: 'Already Linked Webinar',
    });

    try {
      await controller.importZoomSession({ zoomId: '81517150352' });
      fail('expected ConflictException');
    } catch (err) {
      expect(err).toBeInstanceOf(ConflictException);
      const response = (err as ConflictException).getResponse() as {
        message?: string;
        existingProgramId?: string;
      };
      expect(response.existingProgramId).toBe('prog-existing');
      expect(response.message).toContain('Already Linked Webinar');
    }

    expect(zoom.getWebinarById).not.toHaveBeenCalled();
    expect(programsService.createProgram).not.toHaveBeenCalled();
  });

  it('throws when Zoom webinar is not found', async () => {
    prisma.program.findFirst.mockResolvedValue(null);
    zoom.getWebinarById.mockResolvedValue(null);

    await expect(
      controller.importZoomSession({ zoomId: '81517150352' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('creates a published program from an existing Zoom webinar', async () => {
    prisma.program.findFirst.mockResolvedValue(null);
    zoom.getWebinarById.mockResolvedValue({
      id: '81517150352',
      topic: ' Zoom Webinar Title ',
      agenda: 'Detailed agenda',
      startTime: '2026-06-01T18:00:00Z',
      duration: 90,
      joinUrl: 'https://zoom.us/j/attendee',
      startUrl: 'https://zoom.us/s/host',
    });
    programsService.createProgram.mockResolvedValue({
      id: 'prog-import-1',
      title: 'Zoom Webinar Title',
      status: 'PUBLISHED',
    });

    const result = await controller.importZoomSession({
      zoomId: '81517150352',
      sponsorName: ' Sponsor Co ',
    });

    expect(programsService.createProgram).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Zoom Webinar Title',
        description: 'Detailed agenda',
        sponsorName: 'Sponsor Co',
        zoomMeetingId: '81517150352',
        zoomJoinUrl: 'https://zoom.us/j/attendee',
        zoomStartUrl: 'https://zoom.us/s/host',
        status: 'PUBLISHED',
        zoomSessionType: 'WEBINAR',
        registrationRequiresApproval: true,
      }),
    );
    expect(surveysService.attachSurveysForNewWebinar).toHaveBeenCalledWith(
      'prog-import-1',
      'Zoom Webinar Title',
    );
    expect(result).toEqual(
      expect.objectContaining({
        id: 'prog-import-1',
        zoomMeetingId: '81517150352',
        zoomJoinUrl: 'https://zoom.us/j/attendee',
        zoomStartUrl: 'https://zoom.us/s/host',
      }),
    );
  });

  it('uses meeting API for office hours imports', async () => {
    prisma.program.findFirst.mockResolvedValue(null);
    zoom.getMeetingById.mockResolvedValue({
      id: '555',
      topic: 'Office Hours Q&A',
      agenda: '',
      startTime: '2026-06-02T17:00:00Z',
      duration: 30,
      joinUrl: 'https://zoom.us/j/meeting',
      startUrl: 'https://zoom.us/s/meeting-host',
    });
    programsService.createProgram.mockResolvedValue({
      id: 'prog-meeting-1',
      title: 'Office Hours Q&A',
    });

    await controller.importZoomSession({
      zoomId: '555',
      zoomSessionType: 'MEETING',
    });

    expect(zoom.getMeetingById).toHaveBeenCalledWith('555');
    expect(zoom.getWebinarById).not.toHaveBeenCalled();
    expect(surveysService.attachSurveysForNewWebinar).not.toHaveBeenCalled();
  });
});
