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
import { axiosContentHubErrorMeta } from '../../utils/content-hub-error';
import type {
  PublicKol,
  PublicKolList,
  PublicKolPublicationList,
} from './kol-network.types';

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
  ): Promise<PublicKolList> {
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

    if (this.contentHub.isConfigured()) {
      try {
        return await this.contentHub.getKols(params);
      } catch (err: unknown) {
        this.logKolError('Content Hub GET /kols failed', err);
        return empty;
      }
    }

    if (!this.mediahub.isConfigured()) {
      this.logger.warn('KOL producer not configured — /kol-network returning empty');
      return empty;
    }

    try {
      return await this.mediahub.getKols(params);
    } catch (err: unknown) {
      this.logKolError('MediaHub GET /kols failed', err);
      return empty;
    }
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
  async getKol(@Param('slug') slug: string): Promise<PublicKol> {
    try {
      if (this.contentHub.isConfigured()) {
        return await this.contentHub.getKol(slug);
      }
      if (!this.mediahub.isConfigured()) {
        throw new NotFoundException('KOL directory unavailable');
      }
      return await this.mediahub.getKol(slug);
    } catch (err: unknown) {
      const meta = this.logKolError(`GET /kols/${slug} failed`, err);
      if (meta.status === 404) {
        throw new NotFoundException(`KOL "${slug}" not found`);
      }
      throw new NotFoundException(`KOL "${slug}" not found`);
    }
  }
}
