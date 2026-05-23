import { ConfigService } from '@nestjs/config';
import { ZoomWebhookService } from './zoom-webhook.service';
import { PrismaService } from '../../prisma/prisma.service';
import { HubSpotService } from '../hubspot/hubspot.service';
import { SurveysService } from '../surveys/surveys.service';
import { ZoomService } from './zoom.service';

describe('ZoomWebhookService', () => {
  let service: ZoomWebhookService;
  let prisma: {
    program: {
      findFirst: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
    webinarParticipantEvent: { create: jest.Mock };
    user: { findUnique: jest.Mock };
  };
  let zoom: {
    isConfigured: jest.Mock;
    getWebinarById: jest.Mock;
    getMeetingById: jest.Mock;
  };
  let surveys: { attachJotformFormsFromConfig: jest.Mock };

  beforeEach(() => {
    prisma = {
      program: {
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      webinarParticipantEvent: { create: jest.fn() },
      user: { findUnique: jest.fn() },
    };
    zoom = {
      isConfigured: jest.fn().mockReturnValue(true),
      getWebinarById: jest.fn(),
      getMeetingById: jest.fn(),
    };
    surveys = {
      attachJotformFormsFromConfig: jest.fn().mockResolvedValue(undefined),
    };

    service = new ZoomWebhookService(
      prisma as unknown as PrismaService,
      { get: jest.fn().mockReturnValue('test-webhook-secret') } as unknown as ConfigService,
      {} as HubSpotService,
      surveys as unknown as SurveysService,
      zoom as unknown as ZoomService,
    );
  });

  describe('webinar.created import', () => {
    const webinarPayload = {
      event: 'webinar.created',
      payload: {
        object: {
          id: 81517150352,
          topic: 'Imported Oncology Webinar',
          agenda: 'Agenda text',
          start_time: '2026-06-01T18:00:00Z',
          duration: 60,
          join_url: 'https://zoom.us/j/attendee',
        },
      },
    };

    it('creates a DRAFT program flagged importedViaWebhook', async () => {
      prisma.program.findFirst.mockResolvedValue(null);
      zoom.getWebinarById.mockResolvedValue({
        id: '81517150352',
        topic: 'Imported Oncology Webinar',
        joinUrl: 'https://zoom.us/j/attendee',
        startUrl: 'https://zoom.us/s/host',
        startTime: '2026-06-01T18:00:00Z',
        duration: 60,
      });
      prisma.program.create.mockResolvedValue({
        id: 'prog-webhook-1',
        title: 'Imported Oncology Webinar',
      });

      const result = await service.processWebhook(webinarPayload, '', '');

      expect(result).toEqual({ received: true });
      expect(prisma.program.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          title: 'Imported Oncology Webinar',
          description: 'Agenda text',
          status: 'DRAFT',
          zoomSessionType: 'WEBINAR',
          zoomMeetingId: '81517150352',
          zoomJoinUrl: 'https://zoom.us/j/attendee',
          zoomStartUrl: 'https://zoom.us/s/host',
          importedViaWebhook: true,
        }),
      });
      expect(surveys.attachJotformFormsFromConfig).toHaveBeenCalledWith(
        'prog-webhook-1',
        'Imported Oncology Webinar',
      );
    });

    it('is idempotent when a program already exists for the Zoom id', async () => {
      prisma.program.findFirst.mockResolvedValue({ id: 'existing-prog' });

      await service.processWebhook(webinarPayload, '', '');

      expect(prisma.program.create).not.toHaveBeenCalled();
      expect(zoom.getWebinarById).not.toHaveBeenCalled();
      expect(surveys.attachJotformFormsFromConfig).not.toHaveBeenCalled();
    });

    it('does not auto-import meeting.created events', async () => {
      await service.processWebhook(
        {
          event: 'meeting.created',
          payload: {
            object: {
              id: 999,
              topic: 'Office Hours',
              join_url: 'https://zoom.us/j/meeting',
            },
          },
        },
        '',
        '',
      );

      expect(prisma.program.findFirst).not.toHaveBeenCalled();
      expect(prisma.program.create).not.toHaveBeenCalled();
    });
  });

  describe('endpoint.url_validation', () => {
    it('returns encrypted token for Zoom endpoint validation', async () => {
      const result = await service.processWebhook(
        {
          event: 'endpoint.url_validation',
          payload: { plainToken: 'plain-token-123' },
        },
        '',
        '',
      );

      expect(result.plainToken).toBe('plain-token-123');
      expect(result.encryptedToken).toEqual(expect.any(String));
      expect(String(result.encryptedToken).length).toBeGreaterThan(0);
    });
  });
});
