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
   * On 401 (Invalid API key), returns {} so frontend can fall back to YouTube playlists.
   */
  @Get('tags')
  async getTags() {
    if (!this.mediahub.isConfigured()) {
      return {};
    }
    try {
      return await this.mediahub.getTags();
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response
        ?.status;
      if (status === 401) {
        this.logger.warn(
          '[Catalog] MediaHub 401 Invalid API key - returning empty tags. Update mediahub_api_key in Secrets Manager.',
        );
        return {};
      }
      throw err;
    }
  }

  /**
   * GET /api/catalog/clips
   * MediaHub: Video catalog with filters (q, tag, doctor, platform, sort_by, limit, offset).
   * On 401 (Invalid API key), returns empty so frontend can fall back to YouTube playlists.
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
    try {
      // MediaHub supports dedicated `doctor` and `tag` query params; pass both through (do not fold doctor into tag only).
      return await this.mediahub.getClips({
        q,
        tag,
        doctor,
        platform,
        sort_by: sortBy,
        limit: limit ? parseInt(limit, 10) : undefined,
        offset: offset ? parseInt(offset, 10) : undefined,
      });
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response
        ?.status;
      if (status === 401) {
        this.logger.warn(
          '[Catalog] MediaHub 401 Invalid API key - returning empty clips. Update mediahub_api_key in Secrets Manager.',
        );
        return { items: [], total: 0 };
      }
      throw err;
    }
  }

  /**
   * GET /api/catalog/clips/:id
   * MediaHub: Single clip detail.
   * Accepts full ID (e.g. official:youtube:E1tTwDQgMBc) or short YouTube video ID (e.g. E1tTwDQgMBc).
   * Returns null (200) instead of throwing when the clip is not found in MediaHub, so the
   * frontend can show "not available" placeholders rather than an error page.
   */
  @Get('clips/:id')
  async getClip(@Param('id') id: string) {
    if (!this.mediahub.isConfigured()) {
      return null;
    }
    // If id looks like a short YouTube video ID (11 alphanumeric chars, no colons), try official:youtube:{id}
    const shortIdMatch = /^[a-zA-Z0-9_-]{11}$/.exec(id);
    if (shortIdMatch && !id.includes(':')) {
      try {
        return await this.mediahub.getClip(`official:youtube:${id}`);
      } catch {
        // Fall through to try raw id
      }
    }
    try {
      return await this.mediahub.getClip(id);
    } catch {
      // Clip not found in MediaHub — return null so frontend shows "not available"
      return null;
    }
  }

  /**
   * GET /api/catalog/doctors
   * MediaHub: Doctor profiles with slug, shoot count, post count, views/likes.
   * On 401 (Invalid API key), returns [] so frontend can fall back to YouTube playlists.
   */
  @Get('doctors')
  async getDoctors() {
    if (!this.mediahub.isConfigured()) {
      return [];
    }
    try {
      return await this.mediahub.getDoctors();
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response
        ?.status;
      if (status === 401) {
        this.logger.warn(
          '[Catalog] MediaHub 401 Invalid API key - returning empty doctors. Update mediahub_api_key in Secrets Manager.',
        );
        return [];
      }
      throw err;
    }
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
  async search(
    @Query('q') q?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
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
   * Returns null (200) on missing shoot so the frontend shows "not available" rather than an error.
   */
  @Get('transcripts/:shootId')
  async getTranscript(@Param('shootId') shootId: string) {
    if (!this.mediahub.isConfigured()) {
      return null;
    }
    try {
      return await this.mediahub.getTranscript(shootId);
    } catch {
      return null;
    }
  }

  /**
   * GET /api/catalog/random-videos?count=6
   * YouTube: Random videos from playlists for the Home page carousel.
   */
  @Get('random-videos')
  async getRandomVideos(@Query('count') count?: string) {
    return this.catalogService.getRandomVideos(count ? parseInt(count, 10) : 6);
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
