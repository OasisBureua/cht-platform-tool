import {
  Controller,
  Get,
  Logger,
  NotFoundException,
  Param,
  Query,
} from '@nestjs/common';
import { isAxiosError } from 'axios';
import { MediaHubService } from '../catalog/mediahub.service';
import { ContentHubKolService } from './content-hub-kol.service';
import { KolVisibilityService, type KolDirectorySurface } from './kol-visibility.service';
import { axiosContentHubErrorMeta } from '../../utils/content-hub-error';
import type {
  PublicKol,
  PublicKolList,
  PublicKolPublicationList,
} from './kol-network.types';

function parseSurface(value?: string): KolDirectorySurface {
  return value === 'app' ? 'app' : 'public';
}

/**
 * GET /api/kol-network/* → Content Hub (CONTENTHUB_BASE_URL) when configured,
 * else EC2 MediaHub fallback. Catalog stays on MEDIAHUB_BASE_URL.
 */
@Controller('kol-network')
export class KolNetworkController {
  private readonly logger = new Logger(KolNetworkController.name);

  constructor(
    private readonly contentHub: ContentHubKolService,
    private readonly mediahub: MediaHubService,
    private readonly visibility: KolVisibilityService,
  ) {}

  private logKolError(label: string, err: unknown): { status: number; message: string } {
    const meta = isAxiosError(err)
      ? axiosContentHubErrorMeta(err)
      : { status: 500, message: 'Unknown error' };
    this.logger.warn(
      `${label} (status=${meta.status}` +
        `${meta.requestId ? `, upstream-request-id=${meta.requestId}` : ''}): ${meta.message}`,
    );
    return meta;
  }

  @Get()
  async listKols(
    @Query('region') region?: string,
    @Query('institution') institution?: string,
    @Query('q') q?: string,
    @Query('new_only') newOnly?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('surface') surfaceParam?: string,
  ): Promise<PublicKolList> {
    const surface = parseSurface(surfaceParam);
    const params = {
      region,
      institution,
      q,
      new_only: newOnly === 'true' || newOnly === '1',
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
    };
    const empty: PublicKolList = {
      items: [],
      total: 0,
      regions: [],
      institutions: [],
    };

    let list: PublicKolList | null = null;

    if (this.contentHub.isConfigured()) {
      try {
        list = await this.contentHub.getKols(params);
      } catch (err: unknown) {
        this.logKolError('Content Hub GET /kols failed', err);
        return empty;
      }
    } else if (this.mediahub.isConfigured()) {
      try {
        list = await this.mediahub.getKols(params);
      } catch (err: unknown) {
        this.logKolError('MediaHub GET /kols failed', err);
        return empty;
      }
    } else {
      this.logger.warn('KOL producer not configured, /kol-network returning empty');
      return empty;
    }

    const visibility = await this.visibility.getVisibilityMap();
    return this.visibility.filterKolList(list, surface, visibility);
  }

  @Get(':slug/publications')
  async getKolPublications(
    @Param('slug') slug: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ): Promise<PublicKolPublicationList> {
    const params = {
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
    };
    const empty: PublicKolPublicationList = { items: [], total: 0 };

    if (this.contentHub.isConfigured()) {
      try {
        return await this.contentHub.getKolPublications(slug, params);
      } catch (err: unknown) {
        this.logKolError(`Content Hub GET /kols/${slug}/publications failed`, err);
        return empty;
      }
    }

    if (!this.mediahub.isConfigured()) {
      return empty;
    }

    try {
      return await this.mediahub.getKolPublications(slug, params);
    } catch (err: unknown) {
      this.logKolError(`MediaHub GET /kols/${slug}/publications failed`, err);
      return empty;
    }
  }

  @Get(':slug')
  async getKol(
    @Param('slug') slug: string,
    @Query('surface') surfaceParam?: string,
  ): Promise<PublicKol> {
    const surface = parseSurface(surfaceParam);
    try {
      let kol: PublicKol;
      if (this.contentHub.isConfigured()) {
        kol = await this.contentHub.getKol(slug);
      } else if (this.mediahub.isConfigured()) {
        kol = await this.mediahub.getKol(slug);
      } else {
        throw new NotFoundException('KOL directory unavailable');
      }

      const visible = await this.visibility.isKolVisible(kol, surface);
      if (!visible) {
        throw new NotFoundException(`KOL "${slug}" not found`);
      }
      return kol;
    } catch (err: unknown) {
      if (err instanceof NotFoundException) throw err;
      const meta = this.logKolError(`GET /kols/${slug} failed`, err);
      if (meta.status === 404) {
        throw new NotFoundException(`KOL "${slug}" not found`);
      }
      throw new NotFoundException(`KOL "${slug}" not found`);
    }
  }
}
