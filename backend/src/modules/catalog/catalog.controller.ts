import { Controller, Get, Logger, Param, Query } from '@nestjs/common';
import { CatalogService, CatalogItem } from './catalog.service';
import { ContentHubCatalogService } from './contenthub-catalog.service';

@Controller('catalog')
export class CatalogController {
  private readonly logger = new Logger(CatalogController.name);

  constructor(
    private readonly catalogService: CatalogService,
    private readonly contentHub: ContentHubCatalogService,
  ) {}

  /**
   * GET /api/catalog
   * Public endpoint – returns catalog items from Content Hub (when configured),
   * YouTube playlists, or database programs.
   */
  @Get()
  async getCatalog(): Promise<CatalogItem[]> {
    this.logger.log('Getting catalog items');
    return this.catalogService.getCatalogItems();
  }

  /**
   * GET /api/catalog/tags
   * Content Hub: All tags grouped by category (doctor, biomarker, drug, trial, stage, topic, brand).
   * On 401 (Invalid API key), returns {} so frontend can fall back to YouTube playlists.
   */
  @Get('tags')
  async getTags() {
    if (!this.contentHub.isConfigured()) {
      return {};
    }
    try {
      return await this.contentHub.getTags();
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response
        ?.status;
      if (status === 401 || this.contentHub.usesContentHubCatalog()) {
        this.logger.warn(
          '[Catalog] /tags unavailable: returning empty tags.',
        );
        return {};
      }
      throw err;
    }
  }

  /**
   * GET /api/catalog/clips
   *
   * Proxies Content Hub /api/public/clips. Supports the full query
   * surface including Phase 2 additions (sort_by=recorded_at,
   * dedup_by=shoot, per_shoot_cap=N) from the 2026-05-17 video-
   * presentation design doc.
   *
   * Platform default: 'youtube' (set in ContentHubCatalogService). To include
   * LinkedIn/X/etc, pass platform='' or platform='linkedin,x'.
   * Eliminates the audit's LinkedIn-text-post-leak into video
   * carousels.
   *
   * On 401 from Content Hub: returns empty so the frontend can render
   * an empty state.
   */
  @Get('clips')
  async getClips(
    @Query('q') q?: string,
    @Query('tag') tag?: string,
    @Query('doctor') doctor?: string,
    @Query('platform') platform?: string,
    @Query('sort_by')
    sortBy?: 'views' | 'likes' | 'recent' | 'posted' | 'recorded_at',
    @Query('dedup_by') dedupBy?: 'shoot',
    @Query('per_shoot_cap') perShootCap?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('has_wordpress') hasWordpress?: string,
    @Query('wp_category') wpCategory?: string,
  ) {
    if (!this.contentHub.isClipsConfigured()) {
      return { items: [], total: 0 };
    }
    try {
      const hasWordpressFlag =
        hasWordpress === 'true'
          ? true
          : hasWordpress === 'false'
            ? false
            : undefined;
      return await this.contentHub.getClips({
        q,
        tag,
        doctor,
        platform,
        sort_by: sortBy,
        dedup_by: dedupBy,
        per_shoot_cap: perShootCap ? parseInt(perShootCap, 10) : undefined,
        limit: limit ? parseInt(limit, 10) : undefined,
        offset: offset ? parseInt(offset, 10) : undefined,
        has_wordpress: hasWordpressFlag,
        wp_category: wpCategory,
      });
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response
        ?.status;
      if (status === 401) {
        this.logger.warn(
          '[Catalog] Content Hub 401 Unauthorized - check Cognito M2M scopes / platform outbound client.',
        );
        return { items: [], total: 0 };
      }
      throw err;
    }
  }

  /**
   * GET /api/catalog/wordpress/categories
   * ContentHub: WordPress category slugs for biomarker/disease landing nav.
   * Declared before GET wordpress so the more specific path is unambiguous.
   */
  @Get('wordpress/categories')
  async getWordPressCategories(@Query('fresh') fresh?: string) {
    if (!this.contentHub.isConfigured() || !this.contentHub.usesContentHubCatalog()) {
      return { items: [], total: 0 };
    }
    try {
      return await this.contentHub.getWordPressCategories({
        skipCache: fresh === '1' || fresh === 'true',
      });
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response
        ?.status;
      if (status === 401 || status === 404) {
        this.logger.warn(
          `[Catalog] ContentHub ${status} on /wordpress/categories - returning empty.`,
        );
        return { items: [], total: 0 };
      }
      throw err;
    }
  }

  @Get('wordpress/series')
  async getWordPressSeries(@Query('fresh') fresh?: string) {
    if (!this.contentHub.isConfigured() || !this.contentHub.usesContentHubCatalog()) {
      return { items: [], total: 0 };
    }
    try {
      return await this.contentHub.getWordPressSeries({
        skipCache: fresh === '1' || fresh === 'true',
      });
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response
        ?.status;
      if (status === 401 || status === 404) {
        this.logger.warn(
          `[Catalog] ContentHub ${status} on /wordpress/series - returning empty.`,
        );
        return { items: [], total: 0 };
      }
      throw err;
    }
  }

  @Get('wordpress/series/:slug')
  async getWordPressSeriesDetail(
    @Param('slug') slug: string,
    @Query('fresh') fresh?: string,
  ) {
    if (!this.contentHub.isConfigured() || !this.contentHub.usesContentHubCatalog()) {
      return null;
    }
    try {
      return await this.contentHub.getWordPressSeriesDetail(slug, {
        skipCache: fresh === '1' || fresh === 'true',
      });
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response
        ?.status;
      if (status === 401 || status === 404) return null;
      throw err;
    }
  }

  @Get('wordpress/tags')
  async getWordPressTags(@Query('fresh') fresh?: string) {
    if (!this.contentHub.isConfigured() || !this.contentHub.usesContentHubCatalog()) {
      return { items: [], total: 0 };
    }
    try {
      return await this.contentHub.getWordPressTags({
        skipCache: fresh === '1' || fresh === 'true',
      });
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response
        ?.status;
      if (status === 401 || status === 404) {
        this.logger.warn(
          `[Catalog] ContentHub ${status} on /wordpress/tags - returning empty.`,
        );
        return { items: [], total: 0 };
      }
      throw err;
    }
  }

  /**
   * GET /api/catalog/wordpress
   * ContentHub: latest WordPress editorial posts (view-only for admin Content tab).
   */
  @Get('wordpress')
  async getWordPressPosts(
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('q') q?: string,
    @Query('category') category?: string,
    @Query('fresh') fresh?: string,
  ) {
    if (!this.contentHub.isConfigured() || !this.contentHub.usesContentHubCatalog()) {
      return { items: [], total: 0 };
    }
    try {
      return await this.contentHub.getWordPressPosts({
        limit: limit ? parseInt(limit, 10) : undefined,
        offset: offset ? parseInt(offset, 10) : undefined,
        q,
        category,
        skipCache: fresh === '1' || fresh === 'true',
      });
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response
        ?.status;
      if (status === 401 || status === 404) {
        this.logger.warn(
          `[Catalog] ContentHub ${status} on /wordpress - returning empty.`,
        );
        return { items: [], total: 0 };
      }
      throw err;
    }
  }

  /**
   * GET /api/catalog/clips/:id
   * Content Hub: Single clip detail.
   * Accepts full ID (e.g. official:youtube:E1tTwDQgMBc) or short YouTube video ID (e.g. E1tTwDQgMBc).
   * Returns null (200) instead of throwing when the clip is not found in Content Hub, so the
   * frontend can show "not available" placeholders rather than an error page.
   */
  @Get('clips/:id')
  async getClip(@Param('id') id: string) {
    if (!this.contentHub.isClipsConfigured()) {
      return null;
    }
    // If id looks like a short YouTube video ID (11 alphanumeric chars, no colons), try official:youtube:{id}
    const shortIdMatch = /^[a-zA-Z0-9_-]{11}$/.exec(id);
    if (shortIdMatch && !id.includes(':')) {
      try {
        return await this.contentHub.getClip(`official:youtube:${id}`);
      } catch {
        // Fall through to try raw id
      }
    }
    try {
      return await this.contentHub.getClip(id);
    } catch {
      // Clip not found in Content Hub: return null so frontend shows "not available"
      return null;
    }
  }

  /**
   * GET /api/catalog/doctors
   * Content Hub: Doctor profiles with slug, shoot count, post count, views/likes.
   * On 401 (Invalid API key), returns [] so frontend can fall back to YouTube playlists.
   */
  @Get('doctors')
  async getDoctors() {
    if (!this.contentHub.isConfigured()) {
      return [];
    }
    try {
      return await this.contentHub.getDoctors();
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response
        ?.status;
      if (status === 401 || this.contentHub.usesContentHubCatalog()) {
        this.logger.warn(
          '[Catalog] /doctors unavailable: returning empty doctors.',
        );
        return [];
      }
      throw err;
    }
  }

  /**
   * GET /api/catalog/doctors/:slug
   * Content Hub: Doctor detail with all their clips.
   */
  @Get('doctors/:slug')
  async getDoctor(@Param('slug') slug: string) {
    if (!this.contentHub.isConfigured()) {
      return null;
    }
    return this.contentHub.getDoctor(slug);
  }

  /**
   * GET /api/catalog/search
   * Content Hub: Full-text search (alias for clips with q).
   */
  @Get('search')
  async search(
    @Query('q') q?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    if (!this.contentHub.isConfigured() || !q) {
      return { items: [], total: 0 };
    }
    return this.contentHub.search(q, {
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
    });
  }

  /**
   * GET /api/catalog/transcripts/:shootId
   * Legacy Content Hub transcript endpoint removed; returns null so clients show unavailable.
   */
  @Get('transcripts/:shootId')
  async getTranscript(@Param('shootId') _shootId: string) {
    return null;
  }

  /**
   * GET /api/catalog/random-videos?count=6
   * Home carousel: HER2+ catalog clips (ContentHub/Content Hub), with YouTube playlist fallback.
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
   * Accepts a YouTube playlist ID (starts with `PL`, ~34 chars) OR a WordPress
   * series slug. Series slugs resolve through ContentHub's Layer 2 mirror; the
   * response is normalized into the same shape as YT-backed playlists so
   * PlaylistDetail renders either identifier without branching.
   *
   * Match strategy for series slugs, in order:
   *   1. clip.wordpress.post_id ∈ series.post_ids (authoritative WP join)
   *   2. clip has doctor:* tags that cover the series slug's doctor pair
   *      (fallback for when ContentHub's inline wordpress field is empty)
   */
  @Get('playlists/:id')
  async getPlaylist(@Param('id') id: string) {
    const looksLikeYouTubePlaylistId = /^PL[A-Za-z0-9_-]{16,}$/.test(id);
    if (!looksLikeYouTubePlaylistId && this.contentHub.usesContentHubCatalog()) {
      const series = await this.contentHub.getWordPressSeriesDetail(id);
      if (series) {
        const postIdSet = new Set(series.post_ids);
        // Series slugs look like "gadi-yan" / "bardia-callahan" / "dr-joyce-oshaughnessy" —
        // most tokens are doctor last names that appear in clip tags as "doctor:Yan" etc.
        // Some series slugs include first names ("joyce") or the "dr" prefix; those
        // won't match any doctor tag and get dropped from the required-match set.
        const rawTokens = series.slug
          .split('-')
          .map((t) => t.trim().toLowerCase())
          .filter((t) => t.length >= 3 && t !== 'dr' && t !== 'the');

        const clipsPage = await this.contentHub.getClips({
          limit: 200,
          has_wordpress: true,
        });
        const clipItems = clipsPage.items ?? [];

        // Normalize apostrophes + case for slug<->tag matching. WP series
        // slugs strip apostrophes (`odea`) but doctor tags keep them
        // (`doctor:O'Dea`); normalize both sides to compare.
        const norm = (s: string): string =>
          s.toLowerCase().replace(/['’]/g, '');

        // Collect every doctor last name that appears anywhere in the clip
        // corpus, so we can drop series-slug tokens that don't correspond to
        // any real doctor tag (typically first names or unrelated words).
        const knownDoctors = new Set<string>();
        for (const c of clipItems) {
          for (const t of c.tags ?? []) {
            if (t.toLowerCase().startsWith('doctor:')) {
              knownDoctors.add(norm(t.slice('doctor:'.length).trim()));
            }
          }
        }
        const doctorTokens = rawTokens.filter((tok) =>
          Array.from(knownDoctors).some((doc) => doc.includes(tok)),
        );

        const matchByPostId = (c: (typeof clipItems)[number]) =>
          !!c.wordpress?.post_id && postIdSet.has(c.wordpress.post_id);

        const matchByDoctorTags = (c: (typeof clipItems)[number]) => {
          if (doctorTokens.length === 0) return false;
          const clipDoctors = (c.tags ?? [])
            .filter((t) => t.toLowerCase().startsWith('doctor:'))
            .map((t) => norm(t.slice('doctor:'.length).trim()));
          if (clipDoctors.length === 0) return false;
          // Every recognized doctor token in the series slug must appear as
          // (or within) at least one clip doctor tag.
          return doctorTokens.every((token) =>
            clipDoctors.some((doc) => doc.includes(token)),
          );
        };

        const videos = clipItems
          .filter((c) => matchByPostId(c) || matchByDoctorTags(c))
          .map((c) => ({
            id: c.id,
            title: c.title,
            thumbnailUrl: c.thumbnail_url,
            youtubeUrl: c.youtube_url,
          }));
        return {
          playlist: {
            id: series.slug,
            title: series.name,
            thumbnailUrl: videos[0]?.thumbnailUrl ?? '',
            videoNames: videos.map((v) => v.title),
            videoCount: videos.length,
          },
          videos,
          series: { slug: series.slug, wp_term_id: series.wp_term_id },
        };
      }
    }
    return this.catalogService.getPlaylistVideos(id);
  }

  /**
   * GET /api/catalog/playlists-tags
   *
   * Proxies Content Hub /api/public/playlists. Returns the curator-set
   * tag/lane overlay for YouTube playlists. Frontend joins this client-
   * side with the YouTube-sourced playlist metadata from `/playlists`.
   *
   * Replaces the brittle `_generated-catalog-playlists.json` fuzzy-
   * title-match approach (see 2026-05-16 video-presentation audit).
   *
   * On 401 from Content Hub: returns empty so frontend can degrade
   * gracefully (renders as if no playlist has a curator tag yet).
   */
  @Get('playlists-tags')
  async getPlaylistsTags(
    @Query('tag') tag?: string,
    @Query('lane')
    lane?: 'biomarker' | 'drug' | 'trial' | 'doctor_pair' | 'mixed' | 'archive',
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    if (!this.contentHub.isConfigured()) {
      return { items: [], total: 0 };
    }
    try {
      return await this.contentHub.getPlaylistTags({
        tag,
        lane,
        limit: limit ? parseInt(limit, 10) : undefined,
        offset: offset ? parseInt(offset, 10) : undefined,
      });
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response
        ?.status;
      if (status === 401) {
        this.logger.warn(
          '[Catalog] Content Hub 401 on /playlists-tags - returning empty.',
        );
        return { items: [], total: 0 };
      }
      throw err;
    }
  }
}
