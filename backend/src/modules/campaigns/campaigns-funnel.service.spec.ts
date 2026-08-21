import { BadRequestException, NotFoundException } from '@nestjs/common';
import {
  PostEventAttendanceStatus,
  ProgramRegistrationStatus,
} from '@prisma/client';
import { CampaignsFunnelService } from './campaigns-funnel.service';
import {
  FUNNEL_STAGE_KEYS,
  FUNNEL_STAGE_PEOPLE_AVAILABLE,
} from './campaigns-funnel.types';
import {
  buildStagesFromCounts,
  dropOffFromPreviousPct,
  emptyCountsByStage,
} from './campaigns-funnel.util';

function mockHubspot(overrides: Partial<{
  isConfigured: boolean;
  connected: boolean;
  listAllCampaigns: unknown[];
  canReadMetrics: boolean;
  findContactByEmail: unknown | null;
  findContactByNpi: unknown | null;
}> = {}) {
  return {
    isConfigured: jest.fn().mockReturnValue(overrides.isConfigured ?? true),
    getAccountMetadata: jest.fn().mockResolvedValue({
      connected: overrides.connected ?? true,
      accountName: 'Test',
      portalId: '1',
      hubDomain: null,
      scopes: [],
    }),
    listAllCampaigns: jest
      .fn()
      .mockResolvedValue(overrides.listAllCampaigns ?? []),
    probeMarketingAccess: jest.fn().mockResolvedValue({
      canListCampaigns: true,
      canReadCampaignDetails: overrides.canReadMetrics ?? true,
      canReadMetrics: overrides.canReadMetrics ?? true,
      canReadEmailStats: false,
      missingScopes: [],
      messages: [],
    }),
    getCampaignAnalytics: jest.fn().mockResolvedValue({
      metrics: {
        sessions: 100,
        views: 40,
        submissions: 10,
      },
      campaign: null,
      assets: null,
    }),
    findContactByEmail: jest
      .fn()
      .mockResolvedValue(
        overrides.findContactByEmail === undefined
          ? null
          : overrides.findContactByEmail,
      ),
    findContactByNpi: jest
      .fn()
      .mockResolvedValue(
        overrides.findContactByNpi === undefined
          ? null
          : overrides.findContactByNpi,
      ),
  };
}

function mockContentHub(overrides: {
  configured?: boolean;
  items?: unknown[];
  fail?: boolean;
} = {}) {
  return {
    isConfigured: jest
      .fn()
      .mockReturnValue(overrides.configured ?? false),
    listCampaigns: jest.fn().mockImplementation(async () => {
      if (overrides.fail) throw new Error('CH down');
      return { items: overrides.items ?? [], total: overrides.items?.length ?? 0 };
    }),
    getAdminBaseUrl: jest.fn().mockReturnValue(''),
  };
}

function mockPrisma(counts?: {
  registered?: number;
  attended?: number;
  converted?: number;
}) {
  return {
    programRegistration: {
      count: jest.fn().mockImplementation(async ({ where }) => {
        if (
          where?.postEventSurveyAcknowledgedAt &&
          where?.postEventAttendanceStatus ===
            PostEventAttendanceStatus.VERIFIED
        ) {
          return counts?.converted ?? 0;
        }
        if (
          where?.postEventAttendanceStatus ===
          PostEventAttendanceStatus.VERIFIED
        ) {
          return counts?.attended ?? 0;
        }
        if (where?.status === ProgramRegistrationStatus.APPROVED) {
          return counts?.registered ?? 0;
        }
        return 0;
      }),
      findMany: jest.fn().mockResolvedValue([]),
    },
    program: {
      findMany: jest.fn().mockResolvedValue([
        { id: 'prog-1', title: 'Program One' },
      ]),
    },
  };
}

describe('CampaignsFunnelService (Chunk 2 aggregation)', () => {
  describe('drop-off helpers', () => {
    it('computes drop-off percent from previous stage', () => {
      expect(dropOffFromPreviousPct(100, 40)).toBe(60);
      expect(dropOffFromPreviousPct(0, 10)).toBeNull();
      expect(dropOffFromPreviousPct(50, 50)).toBe(0);
      // HubSpot stages are not nested — growth must not show as negative drop-off
      expect(dropOffFromPreviousPct(25, 31079)).toBe(0);
    });

    it('builds six stages with drop-off chain', () => {
      const counts = emptyCountsByStage();
      counts.aware = 100;
      counts.engaged = 40;
      counts.captured = 10;
      counts.registered = 8;
      counts.attended = 5;
      counts.converted = 2;

      const stages = buildStagesFromCounts(counts);
      expect(stages.map((s) => s.key)).toEqual([...FUNNEL_STAGE_KEYS]);
      expect(stages[0].dropOffFromPreviousPct).toBeNull();
      expect(stages[1].dropOffFromPreviousPct).toBe(60);
      expect(stages[2].dropOffFromPreviousPct).toBe(75);
      expect(stages[5].count).toBe(2);
      expect(stages[5].peopleAvailable).toBe(true);
      expect(stages[0].peopleAvailable).toBe(false);
    });
  });

  describe('getFunnel', () => {
    it('rejects invalid startDate', async () => {
      const service = new CampaignsFunnelService(
        mockHubspot() as never,
        mockContentHub() as never,
        mockPrisma() as never,
      );
      await expect(
        service.getFunnel({ startDate: '21-08-2026' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects startDate after endDate', async () => {
      const service = new CampaignsFunnelService(
        mockHubspot() as never,
        mockContentHub() as never,
        mockPrisma() as never,
      );
      await expect(
        service.getFunnel({
          startDate: '2026-08-20',
          endDate: '2026-08-01',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('aggregates HubSpot + CHT counts and preserves Chunk 0 peopleAvailable', async () => {
      const hubspot = mockHubspot({
        listAllCampaigns: [
          { id: 'hs-1', name: 'Campaign A', status: 'active' },
        ],
      });
      const service = new CampaignsFunnelService(
        hubspot as never,
        mockContentHub() as never,
        mockPrisma({
          registered: 8,
          attended: 5,
          converted: 2,
        }) as never,
      );

      const result = await service.getFunnel({
        startDate: '2026-05-01',
        endDate: '2026-08-01',
      });

      expect(result.reportingPeriodStart).toBe('2026-05-01');
      expect(result.reportingPeriodEnd).toBe('2026-08-01');
      expect(result.stages).toHaveLength(6);

      const byKey = Object.fromEntries(
        result.stages.map((s) => [s.key, s]),
      );
      expect(byKey.aware.count).toBe(100);
      expect(byKey.engaged.count).toBe(40);
      expect(byKey.captured.count).toBe(10);
      expect(byKey.registered.count).toBe(8);
      expect(byKey.attended.count).toBe(5);
      expect(byKey.converted.count).toBe(2);
      expect(byKey.engaged.dropOffFromPreviousPct).toBe(60);

      for (const stage of result.stages) {
        expect(stage.peopleAvailable).toBe(
          FUNNEL_STAGE_PEOPLE_AVAILABLE[stage.key],
        );
      }

      expect(result.hubspot.connected).toBe(true);
      expect(result.hubspot.marketingScopesGranted).toBe(true);
      expect(result.clientRollup).toEqual([]);
      expect(result.filters.programs).toEqual([
        { id: 'prog-1', title: 'Program One' },
      ]);
      expect(hubspot.getCampaignAnalytics).toHaveBeenCalled();
    });

    it('returns zero HubSpot stages when token is not configured', async () => {
      const service = new CampaignsFunnelService(
        mockHubspot({ isConfigured: false, connected: false }) as never,
        mockContentHub() as never,
        mockPrisma({ registered: 3, attended: 1, converted: 0 }) as never,
      );

      const result = await service.getFunnel({});
      const byKey = Object.fromEntries(
        result.stages.map((s) => [s.key, s]),
      );
      expect(byKey.aware.count).toBe(0);
      expect(byKey.registered.count).toBe(3);
      expect(result.warnings.some((w) => /HUBSPOT_ACCESS_TOKEN/i.test(w))).toBe(
        true,
      );
      expect(result.contentHub.configured).toBe(false);
    });

    it('survives Content Hub failure and still returns CHT counts', async () => {
      const service = new CampaignsFunnelService(
        mockHubspot({
          listAllCampaigns: [
            { id: 'hs-1', name: 'Campaign A', status: 'active' },
          ],
        }) as never,
        mockContentHub({ configured: true, fail: true }) as never,
        mockPrisma({ registered: 4, attended: 2, converted: 1 }) as never,
      );

      const result = await service.getFunnel({
        startDate: '2026-01-01',
        endDate: '2026-12-31',
      });
      expect(result.contentHub.reachable).toBe(false);
      expect(result.warnings.some((w) => /Content Hub unreachable/i.test(w))).toBe(
        true,
      );
      expect(result.stages.find((s) => s.key === 'registered')?.count).toBe(4);
      expect(result.stages.find((s) => s.key === 'aware')?.count).toBe(100);
    });
  });

  describe('getPeople / getHcp', () => {
    it('requires a valid stage', async () => {
      const service = new CampaignsFunnelService(
        mockHubspot() as never,
        mockContentHub() as never,
        mockPrisma() as never,
      );
      await expect(
        service.getPeople({ stage: 'not-a-stage' as never }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('returns empty items for HubSpot aggregate stages without DB query', async () => {
      const prisma = mockPrisma();
      const service = new CampaignsFunnelService(
        mockHubspot() as never,
        mockContentHub() as never,
        prisma as never,
      );
      const result = await service.getPeople({ stage: 'aware' });
      expect(result.peopleAvailable).toBe(false);
      expect(result.items).toEqual([]);
      expect(result.total).toBe(0);
      expect(result.warnings.some((w) => /aggregate-only/i.test(w))).toBe(
        true,
      );
      expect(prisma.programRegistration.findMany).not.toHaveBeenCalled();
    });

    it('lists CHT registered people from ProgramRegistration', async () => {
      const reviewedAt = new Date('2026-06-15T12:00:00.000Z');
      const prisma = {
        programRegistration: {
          count: jest.fn().mockResolvedValue(1),
          findMany: jest.fn().mockResolvedValue([
            {
              programId: 'prog-1',
              reviewedAt,
              updatedAt: reviewedAt,
              postEventAttendanceReviewedAt: null,
              postEventSurveyAcknowledgedAt: null,
              user: {
                id: 'user-1',
                firstName: 'Ada',
                lastName: 'Lovelace',
                email: 'ada@example.com',
                npiNumber: '1234567890',
              },
              program: { id: 'prog-1', title: 'Program One' },
            },
          ]),
        },
        program: {
          findMany: jest.fn().mockResolvedValue([]),
        },
      };
      const service = new CampaignsFunnelService(
        mockHubspot() as never,
        mockContentHub({ configured: true, items: [] }) as never,
        prisma as never,
      );

      const result = await service.getPeople({
        stage: 'registered',
        startDate: '2026-05-01',
        endDate: '2026-08-01',
        limit: 25,
      });

      expect(result.peopleAvailable).toBe(true);
      expect(result.total).toBe(1);
      expect(result.items).toHaveLength(1);
      expect(result.items[0]).toMatchObject({
        userId: 'user-1',
        firstName: 'Ada',
        lastName: 'Lovelace',
        email: 'ada@example.com',
        npiNumber: '1234567890',
        programId: 'prog-1',
        programTitle: 'Program One',
      });
      expect(prisma.programRegistration.findMany).toHaveBeenCalled();
    });

    it('rejects empty userId', async () => {
      const service = new CampaignsFunnelService(
        mockHubspot() as never,
        mockContentHub() as never,
        mockPrisma() as never,
      );
      await expect(service.getHcp('  ')).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('returns 404 when user does not exist', async () => {
      const prisma = {
        ...mockPrisma(),
        user: {
          findUnique: jest.fn().mockResolvedValue(null),
        },
      };
      const service = new CampaignsFunnelService(
        mockHubspot() as never,
        mockContentHub() as never,
        prisma as never,
      );
      await expect(service.getHcp('missing-user')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('matches HubSpot contact by email and returns CHT activity', async () => {
      const reviewedAt = new Date('2026-06-15T12:00:00.000Z');
      const attendAt = new Date('2026-06-20T12:00:00.000Z');
      const surveyAt = new Date('2026-06-21T12:00:00.000Z');
      const hubspot = mockHubspot({
        findContactByEmail: {
          id: 'hs-1',
          email: 'ada@example.com',
          npiNumber: '1234567890',
          firstName: 'Ada',
          lastName: 'Lovelace',
        },
      });
      const prisma = {
        user: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'user-1',
            firstName: 'Ada',
            lastName: 'Lovelace',
            email: 'ada@example.com',
            npiNumber: '1234567890',
          }),
        },
        programRegistration: {
          count: jest.fn().mockResolvedValue(0),
          findMany: jest.fn().mockResolvedValue([
            {
              programId: 'prog-1',
              status: ProgramRegistrationStatus.APPROVED,
              reviewedAt,
              updatedAt: reviewedAt,
              createdAt: reviewedAt,
              postEventAttendanceStatus: PostEventAttendanceStatus.VERIFIED,
              postEventAttendanceReviewedAt: attendAt,
              postEventSurveyAcknowledgedAt: surveyAt,
              program: { id: 'prog-1', title: 'Program One' },
            },
          ]),
        },
        program: {
          findMany: jest.fn().mockResolvedValue([]),
        },
      };
      const service = new CampaignsFunnelService(
        hubspot as never,
        mockContentHub({
          configured: true,
          items: [
            {
              id: 9,
              name: 'Linked Campaign',
              hubspotCampaignId: 'hs-camp-1',
              clientSponsor: 'Acme Pharma',
              surveySourceProgramId: 'prog-1',
            },
          ],
        }) as never,
        prisma as never,
      );

      const result = await service.getHcp('user-1');
      expect(result.userId).toBe('user-1');
      expect(result.match).toEqual({ matched: true, method: 'email' });
      expect(hubspot.findContactByEmail).toHaveBeenCalledWith('ada@example.com');
      expect(hubspot.findContactByNpi).not.toHaveBeenCalled();
      expect(result.lastCampaign).toMatchObject({
        id: 'hs-camp-1',
        name: 'Linked Campaign',
        clientSponsor: 'Acme Pharma',
      });
      expect(result.lastChtActivity.map((e) => e.type)).toEqual([
        'survey',
        'attend',
        'register',
      ]);
    });

    it('falls back to NPI match when email is not in HubSpot', async () => {
      const hubspot = mockHubspot({
        findContactByEmail: null,
        findContactByNpi: {
          id: 'hs-2',
          email: 'other@example.com',
          npiNumber: '1234567890',
          firstName: 'Ada',
          lastName: 'Lovelace',
        },
      });
      const prisma = {
        user: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'user-1',
            firstName: 'Ada',
            lastName: 'Lovelace',
            email: 'ada@example.com',
            npiNumber: '1234567890',
          }),
        },
        programRegistration: {
          count: jest.fn().mockResolvedValue(0),
          findMany: jest.fn().mockResolvedValue([]),
        },
        program: {
          findMany: jest.fn().mockResolvedValue([]),
        },
      };
      const service = new CampaignsFunnelService(
        hubspot as never,
        mockContentHub({ configured: true, items: [] }) as never,
        prisma as never,
      );

      const result = await service.getHcp('user-1');
      expect(result.match).toEqual({ matched: true, method: 'npi' });
      expect(hubspot.findContactByEmail).toHaveBeenCalled();
      expect(hubspot.findContactByNpi).toHaveBeenCalledWith('1234567890');
    });
  });
});
