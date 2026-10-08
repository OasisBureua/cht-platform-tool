import { NotFoundException } from '@nestjs/common';
import { CampaignLinksController } from './campaign-links.controller';
import type { CampaignExportIngestService } from '../content-hub/campaign-export-ingest.service';
import type { PrismaService } from '../../prisma/prisma.service';

describe('CampaignLinksController', () => {
  const triggerForProgramLink = jest.fn();
  const prisma = {
    program: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
  };
  const exportIngest = {
    triggerForProgramLink,
  } as unknown as CampaignExportIngestService;
  const controller = new CampaignLinksController(
    prisma as unknown as PrismaService,
    exportIngest,
  );

  beforeEach(() => jest.clearAllMocks());

  it('fires Hub ingest for the new campaign after link', async () => {
    prisma.program.findUnique.mockResolvedValue({
      id: 'prog-1',
      campaignId: null,
    });
    prisma.program.update.mockResolvedValue({
      id: 'prog-1',
      title: 'Webinar',
      status: 'PUBLISHED',
      startDate: null,
      zoomSessionType: 'WEBINAR',
      chmProgramId: null,
      campaignId: '42',
    });

    await controller.linkProgram('prog-1', { campaignId: '42' });

    expect(triggerForProgramLink).toHaveBeenCalledWith({
      previousCampaignId: null,
      nextCampaignId: '42',
    });
  });

  it('404 when the program is missing', async () => {
    prisma.program.findUnique.mockResolvedValue(null);
    await expect(
      controller.linkProgram('missing', { campaignId: '42' }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(triggerForProgramLink).not.toHaveBeenCalled();
  });
});
