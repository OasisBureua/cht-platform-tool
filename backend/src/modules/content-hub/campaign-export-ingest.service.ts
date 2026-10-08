import {
  BadGatewayException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { isAxiosError } from 'axios';
import { PrismaService } from '../../prisma/prisma.service';
import { axiosContentHubErrorMeta } from '../../utils/content-hub-error';
import { ContentHubCampaignService } from './content-hub-campaign.service';

export type ExportIngestTrigger =
  | 'manual'
  | 'platform_link'
  | 'platform_zoom'
  | 'platform_generate'
  | 'platform_refresh';

export type ExportIngestRunView = {
  id?: number;
  campaignId?: number;
  trigger?: string;
  status?: string;
  sessionsUpserted?: number;
  attendanceUpserted?: number;
  surveysUpserted?: number;
  error?: string | null;
};

/** Parse Hub campaigns.id stored as Program.campaignId / Reports campaignId. */
export function parseHubCampaignId(
  value: string | null | undefined,
): number | null {
  const raw = (value || '').trim();
  if (!raw) return null;
  if (!/^\d+$/.test(raw)) return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

/**
 * CPR-41 — Platform → Hub export-ingest triggers.
 * Generate/Refresh await; link/Zoom fire-and-forget via triggerInBackground.
 */
@Injectable()
export class CampaignExportIngestService {
  private readonly logger = new Logger(CampaignExportIngestService.name);

  constructor(
    private readonly campaigns: ContentHubCampaignService,
    private readonly prisma: PrismaService,
  ) {}

  isConfigured(): boolean {
    return this.campaigns.isConfigured();
  }

  async ingestCampaign(
    campaignId: string,
    trigger: ExportIngestTrigger,
  ): Promise<ExportIngestRunView> {
    const hubId = parseHubCampaignId(campaignId);
    if (hubId == null) {
      throw new ServiceUnavailableException(
        `Invalid Hub campaign id for export ingest: ${campaignId}`,
      );
    }
    if (!this.isConfigured()) {
      throw new ServiceUnavailableException(
        'Content Hub admin API is not configured (CONTENTHUB_ADMIN_BASE_URL / Cognito M2M)',
      );
    }

    const exportCampaignId = String(hubId);
    try {
      const run = await this.campaigns.exportIngest<ExportIngestRunView>(hubId, {
        exportCampaignId,
        trigger,
      });
      if (run?.status === 'error') {
        throw new BadGatewayException(
          run.error || 'Hub export ingest failed',
        );
      }
      return run ?? { campaignId: hubId, trigger, status: 'success' };
    } catch (err) {
      if (
        err instanceof BadGatewayException ||
        err instanceof ServiceUnavailableException
      ) {
        throw err;
      }
      const meta = isAxiosError(err)
        ? axiosContentHubErrorMeta(err)
        : { status: 502, message: errMessage(err) };
      this.logger.warn(
        `[export-ingest] failed campaignId=${exportCampaignId} trigger=${trigger} status=${meta.status}: ${meta.message}`,
      );
      if (meta.status === 503 || meta.status === 401 || meta.status === 403) {
        throw new ServiceUnavailableException(
          `Hub export ingest unavailable: ${meta.message}`,
        );
      }
      throw new BadGatewayException(
        `Hub export ingest failed: ${meta.message}`,
      );
    }
  }

  /**
   * Fire-and-forget for link/Zoom. Never throws to the caller.
   * Skips quietly when Hub is not configured or the id is invalid.
   */
  triggerInBackground(
    campaignId: string | null | undefined,
    trigger: ExportIngestTrigger,
  ): void {
    const hubId = parseHubCampaignId(campaignId);
    if (hubId == null) return;
    if (!this.isConfigured()) {
      this.logger.warn(
        `[export-ingest] skip trigger=${trigger} campaignId=${hubId}: Hub M2M not configured`,
      );
      return;
    }
    void this.ingestCampaign(String(hubId), trigger).catch((err) => {
      this.logger.warn(
        `[export-ingest] background ${trigger} campaignId=${hubId}: ${errMessage(err)}`,
      );
    });
  }

  /** After program link/unlink: refresh previous and/or next Hub campaign. */
  triggerForProgramLink(opts: {
    previousCampaignId: string | null | undefined;
    nextCampaignId: string | null | undefined;
  }): void {
    const prev = (opts.previousCampaignId || '').trim() || null;
    const next = (opts.nextCampaignId || '').trim() || null;
    if (prev && prev !== next) {
      this.triggerInBackground(prev, 'platform_link');
    }
    if (next) {
      this.triggerInBackground(next, 'platform_link');
    }
  }

  /** Resolve Program.campaignId then fire Zoom ingest. */
  async triggerForProgramZoom(programId: string): Promise<void> {
    const program = await this.prisma.program.findUnique({
      where: { id: programId },
      select: { campaignId: true },
    });
    this.triggerInBackground(program?.campaignId, 'platform_zoom');
  }
}

function errMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}
