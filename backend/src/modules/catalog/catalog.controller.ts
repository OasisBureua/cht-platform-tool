import { Controller, Get, Logger, Param, Query } from '@nestjs/common';
import { CatalogService, CatalogItem } from './catalog.service';
import { MediaHubService } from './mediahub.service';

@Controller('catalog')
export class CatalogController {
  private readonly logger = new Logger(CatalogController.name);

  constructor(
    private readonly catalogService: CatalogService,
    private readonly mediahub: MediaHubService,
  ) {}

  /**
   * GET /api/catalog
   * Public endpoint – returns catalog items from MediaHub (when configured),
   * YouTube playlists, or database programs.
   */
  @Get()
  async getCatalog(): Promise<CatalogItem[]> {
    this.logger.log('Getting catalog items');
    return this.catalogService.getCatalogItems();
  }

  /**
   * GET /api/catalog/tags
   * MediaHub: All tags grouped by category (doctor, biomarker, drug, trial, stage, topic, brand).
   */
  @Get('tags')
  async getTags() {
    if (!this.mediahub.isConfigured()) {
      return {};
    }
    return this.mediahub.getTags();
  }

  /**
   * GET /api/catalog/clips
   * MediaHub: Video catalog with filters (q, tag, doctor, platform, sort_by, limit, offset).
   */
  @Get('clips')
  async getClips(
    @Query('q') q?: string,
    @Query('tag') tag?: string,
    @Query('doctor') doctor?: string,
    @Query('platform') platform?: string,
    @Query('sort_by') sortBy?: 'views' | 'likes' | 'recent' | 'posted',
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    if (!this.mediahub.isConfigured()) {
      return { items: [], total: 0 };
    }
    const doctorTag = doctor ? `doctor:${doctor}` : undefined;
    return this.mediahub.getClips({
      q,
      tag: doctorTag || tag,
      platform,
      sort_by: sortBy,
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
    });
  }

  /**
   * GET /api/catalog/clips/:id
   * MediaHub: Single clip detail.
   */
  @Get('clips/:id')
  async getClip(@Param('id') id: string) {
    if (!this.mediahub.isConfigured()) {
      return null;
    }
    return this.mediahub.getClip(id);
  }

  /**
   * GET /api/catalog/doctors
   * MediaHub: Doctor profiles with slug, shoot count, post count, views/likes.
   */
  @Get('doctors')
  async getDoctors() {
    if (!this.mediahub.isConfigured()) {
      return [];
    }
    return this.mediahub.getDoctors();
  }

  /**
   * GET /api/catalog/doctors/:slug
   * MediaHub: Doctor detail with all their clips.
   */
  @Get('doctors/:slug')
  async getDoctor(@Param('slug') slug: string) {
    if (!this.mediahub.isConfigured()) {
      return null;
    }
    return this.mediahub.getDoctor(slug);
  }

  /**
   * GET /api/catalog/search
   * MediaHub: Full-text search (alias for clips with q).
   */
  @Get('search')
  async search(@Query('q') q?: string, @Query('limit') limit?: string, @Query('offset') offset?: string) {
    if (!this.mediahub.isConfigured() || !q) {
      return { items: [], total: 0 };
    }
    return this.mediahub.search(q, {
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
    });
  }

  /**
   * GET /api/catalog/transcripts/:shootId
   * MediaHub: Full diarized transcript with speaker names.
   */
  @Get('transcripts/:shootId')
  async getTranscript(@Param('shootId') shootId: string) {
    if (!this.mediahub.isConfigured()) {
      return null;
    }
    return this.mediahub.getTranscript(shootId);
  }

  /**
   * GET /api/catalog/playlists
   * YouTube: Playlists for Catalog page (when YouTube configured).
   */
  @Get('playlists')
  async getPlaylists(): Promise<CatalogItem[]> {
    return this.catalogService.getPlaylists();
  }

  /**
   * GET /api/catalog/playlists/:id
   * YouTube: Playlist details + videos for Playlist detail page.
   */
  @Get('playlists/:id')
  async getPlaylist(@Param('id') id: string) {
    return this.catalogService.getPlaylistVideos(id);
  }
}
