import { Controller, Get, Logger, NotFoundException, Param, Query } from '@nestjs/common';
import {
  MediaHubService,
  MediaHubKol,
  MediaHubKolList,
  MediaHubKolPublicationList,
} from '../catalog/mediahub.service';

/**
 * Public KOL Network controller — proxies to MediaHub `/api/public/kols`.
 *
 * Replaces the hardcoded `frontend/src/data/dol-network.ts` data file.
 * Same headers/auth pattern as CatalogController — MediaHub API key stays
 * server-side; the frontend only sees CHT's own /api/kol-network/* surface.
 */
@Controller('kol-network')
export class KolNetworkController {
  private readonly logger = new Logger(KolNetworkController.name);

  constructor(private readonly mediahub: MediaHubService) {}

  /**
   * GET /api/kol-network
   * Returns the full list with region + institution facets, applying any
   * filters the frontend sent. On any MediaHub error, returns an empty
   * list so the page degrades gracefully instead of 500-ing.
   */
  @Get()
  async listKols(
    @Query('region') region?: string,
    @Query('institution') institution?: string,
    @Query('q') q?: string,
    @Query('new_only') newOnly?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ): Promise<MediaHubKolList> {
    if (!this.mediahub.isConfigured()) {
      this.logger.warn('MediaHub not configured — /kol-network returning empty');
      return { items: [], total: 0, regions: [], institutions: [] };
    }
    try {
      return await this.mediahub.getKols({
        region,
        institution,
        q,
        new_only: newOnly === 'true' || newOnly === '1',
        limit: limit ? Number(limit) : undefined,
        offset: offset ? Number(offset) : undefined,
      });
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      this.logger.warn(
        `MediaHub /kols failed (status=${status ?? 'unknown'}) — returning empty list`,
      );
      return { items: [], total: 0, regions: [], institutions: [] };
    }
  }

  /**
   * GET /api/kol-network/:slug
   * Single KOL profile detail. 404s when MediaHub returns 404 or the slug
   * doesn't exist; other errors degrade to 404 so the profile page can
   * show a clean "not found" state instead of a 5xx error screen.
   */
  @Get(':slug')
  async getKol(@Param('slug') slug: string): Promise<MediaHubKol> {
    if (!this.mediahub.isConfigured()) {
      throw new NotFoundException('KOL directory unavailable');
    }
    try {
      return await this.mediahub.getKol(slug);
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 404) {
        throw new NotFoundException(`KOL "${slug}" not found`);
      }
      this.logger.warn(`MediaHub /kols/${slug} failed (status=${status ?? 'unknown'})`);
      throw new NotFoundException(`KOL "${slug}" not found`);
    }
  }

  /**
   * GET /api/kol-network/:slug/publications
   * Recent publications for a KOL. Empty list when MediaHub returns 404
   * or the KOL has no OpenAlex linkage; never 500s — the profile page
   * just renders a graceful empty state.
   */
  @Get(':slug/publications')
  async getKolPublications(
    @Param('slug') slug: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ): Promise<MediaHubKolPublicationList> {
    if (!this.mediahub.isConfigured()) {
      return { items: [], total: 0 };
    }
    try {
      return await this.mediahub.getKolPublications(slug, {
        limit: limit ? Number(limit) : undefined,
        offset: offset ? Number(offset) : undefined,
      });
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      this.logger.warn(
        `MediaHub /kols/${slug}/publications failed (status=${status ?? 'unknown'})`,
      );
      return { items: [], total: 0 };
    }
  }
}
