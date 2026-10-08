import {
  BadGatewayException,
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { AxiosError } from 'axios';
import {
  CampaignExportIngestService,
  parseHubCampaignId,
} from './campaign-export-ingest.service';
import type { ContentHubCampaignService } from './content-hub-campaign.service';
import type { PrismaService } from '../../prisma/prisma.service';

function axiosErr(status: number, message: string): AxiosError {
  const err = new AxiosError(message);
  err.response = {
    status,
    statusText: String(status),
    data: { detail: message },
    headers: {},
    config: {} as never,
  };
  return err;
}

describe('parseHubCampaignId', () => {
  it('accepts positive integer strings', () => {
    expect(parseHubCampaignId('42')).toBe(42);
    expect(parseHubCampaignId(' 7 ')).toBe(7);
  });

  it('rejects non-numeric and empty values', () => {
    expect(parseHubCampaignId(null)).toBeNull();
    expect(parseHubCampaignId('')).toBeNull();
    expect(parseHubCampaignId('AZ-25-01_LIV001')).toBeNull();
    expect(parseHubCampaignId('0')).toBeNull();
    expect(parseHubCampaignId('-1')).toBeNull();
  });
});

describe('CampaignExportIngestService', () => {
  const exportIngest = jest.fn().mockResolvedValue({ status: 'success' });
  const campaigns = {
    isConfigured: jest.fn().mockReturnValue(true),
    exportIngest,
  };
  const prisma = {
    program: { findUnique: jest.fn() },
  };
  const service = new CampaignExportIngestService(
    campaigns as unknown as ContentHubCampaignService,
    prisma as unknown as PrismaService,
  );

  beforeEach(() => jest.clearAllMocks());

  it('ingests with Hub id as exportCampaignId', async () => {
    await service.ingestCampaign('42', 'platform_generate');
    expect(exportIngest).toHaveBeenCalledWith(42, {
      exportCampaignId: '42',
      trigger: 'platform_generate',
    });
  });

  it('returns 400 for a non-numeric campaign id', async () => {
    await expect(
      service.ingestCampaign('AZ-25-01_LIV001', 'platform_refresh'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(exportIngest).not.toHaveBeenCalled();
  });

  it('triggerForProgramLink fires only the next campaign', () => {
    const spy = jest.spyOn(service, 'triggerInBackground');
    try {
      service.triggerForProgramLink({
        previousCampaignId: '10',
        nextCampaignId: '20',
      });
      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy).toHaveBeenCalledWith('20', 'platform_link');
    } finally {
      spy.mockRestore();
    }
  });

  it('triggerForProgramLink skips unlink (no next campaign)', () => {
    const spy = jest.spyOn(service, 'triggerInBackground');
    try {
      service.triggerForProgramLink({
        previousCampaignId: '10',
        nextCampaignId: null,
      });
      expect(spy).not.toHaveBeenCalled();
    } finally {
      spy.mockRestore();
    }
  });

  it('maps Hub 503/401/403 to 503 and other errors to 502', async () => {
    exportIngest.mockRejectedValueOnce(axiosErr(503, 'no base url'));
    await expect(
      service.ingestCampaign('42', 'platform_generate'),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);

    exportIngest.mockRejectedValueOnce(axiosErr(401, 'unauthorized'));
    await expect(
      service.ingestCampaign('42', 'platform_generate'),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);

    exportIngest.mockRejectedValueOnce(axiosErr(502, 'bad gateway'));
    await expect(
      service.ingestCampaign('42', 'platform_generate'),
    ).rejects.toBeInstanceOf(BadGatewayException);
  });
});
