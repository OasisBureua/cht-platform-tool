import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Logger,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  ServiceUnavailableException,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { isAxiosError } from 'axios';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RolesGuard } from '../../auth/roles.guard';
import { Roles } from '../../auth/roles.decorator';
import { CacheClearService } from '../../cache/cache-clear.service';
import { axiosContentHubErrorMeta } from '../../utils/content-hub-error';
import { AdminAuditInterceptor } from '../admin/admin-audit.interceptor';
import { HubSpotService } from '../hubspot/hubspot.service';
import { ZoomService } from '../webinars/zoom.service';
import {
  ContentHubCampaignService,
  type CampaignPlatform,
} from './content-hub-campaign.service';

/** Platforms whose credentials and connection status live on CHT, not Content Hub. */
const CHT_INTEGRATION_KEYS = new Set(['hubspot', 'livestream', 'survey']);

type IntegrationStatusBlock = {
  managedBy: 'cht' | 'contenthub';
  connected: boolean;
  note: string;
  error?: string;
  accountName?: string | null;
  portalId?: string | null;
  enabled?: boolean;
};

@ApiTags('Admin')
@ApiBearerAuth()
@Controller('admin/content-hub')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@UseInterceptors(AdminAuditInterceptor)
export class AdminContentHubController {
  private readonly logger = new Logger(AdminContentHubController.name);

  constructor(
    private readonly campaigns: ContentHubCampaignService,
    private readonly hubspot: HubSpotService,
    private readonly zoom: ZoomService,
    private readonly cacheClear: CacheClearService,
  ) {}

  private assertHub(): void {
    if (!this.campaigns.isConfigured()) {
      throw new ServiceUnavailableException(
        'Content Hub admin API is not configured (CONTENTHUB_ADMIN_BASE_URL / CONTENTHUB_API_KEY)',
      );
    }
  }

  private async afterHubWrite(): Promise<void> {
    await this.cacheClear.clear('contenthub');
  }

  private mapAxiosError(err: unknown): never {
    if (isAxiosError(err)) {
      const meta = axiosContentHubErrorMeta(err);
      if (meta.status === 404) {
        throw new NotFoundException(meta.message || 'Not found');
      }
      if (meta.status === 400) {
        throw new BadRequestException(meta.message || 'Bad request');
      }
    }
    throw err;
  }

  private async hubCall<T>(fn: () => Promise<T>): Promise<T> {
    this.assertHub();
    try {
      return await fn();
    } catch (err: unknown) {
      this.mapAxiosError(err);
    }
  }

  // ─── Campaigns ───────────────────────────────────────────────────────────

  @Get('campaigns')
  @ApiOperation({ summary: 'List campaign reports (proxied from Content Hub)' })
  async listCampaigns(@Query('q') q?: string) {
    return this.hubCall(() => this.campaigns.listCampaigns(q?.trim() || undefined));
  }

  @Get('campaigns/:id')
  async getCampaign(@Param('id') id: string) {
    return this.hubCall(() => this.campaigns.getCampaign(id));
  }

  @Post('campaigns')
  async createCampaign(@Body() body: Record<string, unknown>) {
    const created = await this.hubCall(() => this.campaigns.createCampaign(body));
    await this.afterHubWrite();
    return created;
  }

  @Patch('campaigns/:id')
  async updateCampaign(
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
  ) {
    const updated = await this.hubCall(() =>
      this.campaigns.updateCampaign(id, body),
    );
    await this.afterHubWrite();
    return updated;
  }

  @Delete('campaigns/:id')
  async deleteCampaign(@Param('id') id: string) {
    await this.hubCall(() => this.campaigns.deleteCampaign(id));
    await this.afterHubWrite();
    return { deleted: true, id };
  }

  // ─── Platform data ───────────────────────────────────────────────────────

  @Get('campaigns/:id/platform-data')
  async getPlatformData(@Param('id') id: string) {
    return this.hubCall(() => this.campaigns.getPlatformData(id));
  }

  @Post('campaigns/:id/platforms/:platform/sync')
  @ApiParam({ name: 'platform', enum: ['linkedin', 'meta', 'youtube', 'livestream', 'survey'] })
  async syncPlatform(
    @Param('id') id: string,
    @Param('platform') platform: CampaignPlatform,
  ) {
    const result = await this.hubCall(() =>
      this.campaigns.syncPlatform(id, platform),
    );
    await this.afterHubWrite();
    return result;
  }

  @Post('campaigns/:id/sync-all')
  async syncAll(@Param('id') id: string) {
    const result = await this.hubCall(() => this.campaigns.syncAll(id));
    await this.afterHubWrite();
    return result;
  }

  @Post('campaigns/:id/uploads')
  async uploadCsv(
    @Param('id') id: string,
    @Body()
    body: { platform: CampaignPlatform; filename: string; content: string },
  ) {
    const result = await this.hubCall(() => this.campaigns.uploadCsv(id, body));
    await this.afterHubWrite();
    return result;
  }

  @Get('campaigns/:id/validation')
  async getValidation(@Param('id') id: string) {
    const validation = await this.hubCall(() =>
      this.campaigns.getValidation(id),
    );
    return {
      ...(typeof validation === 'object' && validation ? validation : {}),
      hubspotConnected: this.hubspot.isConfigured(),
    };
  }

  // ─── Reports (orchestration: no cache) ──────────────────────────────────

  @Get('campaigns/:id/report')
  async getAnalyticsReport(@Param('id') id: string) {
    return this.hubCall(async () => {
      await this.campaigns.getCampaign(id);
      await this.campaigns.getPlatformData(id);
      return this.campaigns.generateReport(id);
    });
  }

  @Get('campaigns/:id/executive-report')
  async getExecutiveReport(@Param('id') id: string) {
    return this.hubCall(() => this.campaigns.generateExecutiveReport(id));
  }

  @Post('campaigns/:id/insights')
  async generateInsights(@Param('id') id: string) {
    const result = await this.hubCall(() => this.campaigns.generateInsights(id));
    await this.afterHubWrite();
    return result;
  }

  // ─── Templates ───────────────────────────────────────────────────────────

  @Get('templates')
  async listTemplates() {
    return this.hubCall(() => this.campaigns.listTemplates());
  }

  @Post('templates')
  async createTemplate(@Body() body: Record<string, unknown>) {
    const created = await this.hubCall(() => this.campaigns.createTemplate(body));
    await this.afterHubWrite();
    return created;
  }

  @Delete('templates/:id')
  async deleteTemplate(@Param('id') id: string) {
    await this.hubCall(() => this.campaigns.deleteTemplate(id));
    await this.afterHubWrite();
    return { deleted: true, id };
  }

  // ─── Integrations ────────────────────────────────────────────────────────

  @Get('integrations')
  @ApiOperation({
    summary:
      'Integration connection status: Hub (LI/Meta/YT) + CHT (HubSpot, Zoom livestream, native surveys)',
  })
  async getIntegrations() {
    const hubPlatforms = this.normalizeHubIntegrations(
      await this.fetchHubIntegrations(),
    );
    return {
      ...hubPlatforms,
      hubspot: await this.buildHubspotIntegration(),
      livestream: this.buildZoomIntegration(),
      survey: this.buildNativeSurveyIntegration(),
    };
  }

  @Patch('integrations')
  async patchIntegrations(@Body() body: Record<string, unknown>) {
    const { hubspot: _ignored, ...rest } = body;
    const updated = await this.hubCall(() => this.campaigns.patchIntegrations(rest));
    await this.afterHubWrite();
    return updated;
  }

  @Get('integrations/hubspot/status')
  async getHubspotStatus() {
    return this.buildHubspotIntegration();
  }

  @Get('health')
  @ApiOperation({ summary: 'Content Hub dependency health (reachability only)' })
  async getHealth() {
    return {
      status: 'ok',
      contentHub: await this.probeContentHub(),
    };
  }

  private normalizeHubIntegrations(
    hubPlatforms: Record<string, unknown>,
  ): Record<string, IntegrationStatusBlock> {
    return Object.fromEntries(
      Object.entries(hubPlatforms).map(([key, value]) => {
        const block =
          value && typeof value === 'object'
            ? (value as Record<string, unknown>)
            : {};
        const connected = Boolean(
          block.connected ?? block.enabled ?? block.configured,
        );
        return [
          key,
          {
            managedBy: 'contenthub' as const,
            connected,
            note:
              typeof block.note === 'string'
                ? block.note
                : 'Configured on Content Hub.',
            error: typeof block.error === 'string' ? block.error : undefined,
            enabled:
              typeof block.enabled === 'boolean' ? block.enabled : undefined,
          },
        ];
      }),
    );
  }

  private async fetchHubIntegrations(): Promise<Record<string, unknown>> {
    if (!this.campaigns.isConfigured()) {
      return {};
    }
    try {
      const hub = await this.campaigns.getIntegrations();
      if (!hub || typeof hub !== 'object') return {};
      return Object.fromEntries(
        Object.entries(hub as Record<string, unknown>).filter(
          ([key]) => !CHT_INTEGRATION_KEYS.has(key),
        ),
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Hub integrations unavailable';
      this.logger.warn(`Hub integrations fetch failed: ${message}`);
      return {};
    }
  }

  private async buildHubspotIntegration(): Promise<IntegrationStatusBlock> {
    const meta = await this.hubspot.getAccountMetadata();
    if (!meta.connected) {
      return {
        managedBy: 'cht',
        connected: false,
        accountName: null,
        portalId: null,
        note: 'HUBSPOT_ACCESS_TOKEN in platform secrets. Use Sync on campaign detail.',
        error:
          meta.error ??
          'HUBSPOT_ACCESS_TOKEN not configured in platform secrets.',
      };
    }
    return {
      managedBy: 'cht',
      connected: true,
      accountName: meta.accountName,
      portalId: meta.portalId,
      note: 'HUBSPOT_ACCESS_TOKEN in platform secrets. Use Sync on campaign detail.',
      ...(meta.error ? { error: meta.error } : {}),
    };
  }

  private buildZoomIntegration(): IntegrationStatusBlock {
    if (!this.zoom.isConfigured()) {
      return {
        managedBy: 'cht',
        connected: false,
        note: 'Zoom webinars and livestream attendance (ZOOM_ACCOUNT_ID, ZOOM_CLIENT_ID, ZOOM_CLIENT_SECRET).',
        error:
          'Zoom not configured. Add ZOOM_ACCOUNT_ID, ZOOM_CLIENT_ID, ZOOM_CLIENT_SECRET.',
      };
    }
    return {
      managedBy: 'cht',
      connected: true,
      note: 'Zoom webinars and livestream attendance (ZOOM_* platform secrets).',
    };
  }

  private buildNativeSurveyIntegration(): IntegrationStatusBlock {
    return {
      managedBy: 'cht',
      connected: true,
      note: 'Native intake and post-event surveys on CHT (no external connector).',
    };
  }

  private async probeContentHub(): Promise<{
    configured: boolean;
    reachable: boolean;
    error?: string;
  }> {
    if (!this.campaigns.isConfigured()) {
      return {
        configured: false,
        reachable: false,
        error:
          'CONTENTHUB_ADMIN_BASE_URL / CONTENTHUB_API_KEY not configured.',
      };
    }
    try {
      await this.campaigns.listCampaigns();
      return { configured: true, reachable: true };
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Content Hub unreachable';
      this.logger.warn(`Content Hub health probe failed: ${message}`);
      return { configured: true, reachable: false, error: message };
    }
  }

  // ─── HubSpot sync (CHT only) ─────────────────────────────────────────────

  @Post('campaigns/:id/hubspot/sync')
  async hubspotSync(@Param('id') id: string) {
    if (!this.hubspot.isConfigured()) {
      throw new BadRequestException(
        'HUBSPOT_ACCESS_TOKEN not configured in platform secrets.',
      );
    }

    const campaign = await this.hubCall(() =>
      this.campaigns.getCampaign<{
        hubspotCampaignId?: string;
        reportingPeriodStart?: string;
        reportingPeriodEnd?: string;
      }>(id),
    );

    const hubspotRawData = await this.hubspot.getCampaignAnalytics({
      hubspotCampaignId: campaign.hubspotCampaignId,
      reportingPeriodStart: campaign.reportingPeriodStart,
      reportingPeriodEnd: campaign.reportingPeriodEnd,
    });
    const syncedAt = hubspotRawData.syncedAt;

    if (hubspotRawData.errors.length) {
      this.logger.warn(
        `HubSpot sync for campaign ${id} completed with errors: ${hubspotRawData.errors.join('; ')}`,
      );
    }

    await this.hubCall(() =>
      this.campaigns.updateCampaign(id, {
        hubspotSyncedAt: syncedAt,
        hubspotRawData,
      }),
    );
    await this.afterHubWrite();

    this.logger.log(
      `HubSpot analytics snapshot PATCHed to Hub campaign ${id} (phase=${hubspotRawData.phase})`,
    );
    return {
      synced: true,
      syncedAt,
      warnings: hubspotRawData.warnings,
      errors: hubspotRawData.errors,
    };
  }
}
