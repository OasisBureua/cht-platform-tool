import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Logger,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
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
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RolesGuard } from '../../auth/roles.guard';
import { Roles } from '../../auth/roles.decorator';
import { CurrentUser } from '../../auth/current-user.decorator';
import type { AuthUser } from '../../auth/auth.service';
import { UserRole } from '@prisma/client';
import { CacheClearService } from '../../cache/cache-clear.service';
import { axiosContentHubErrorMeta } from '../../utils/content-hub-error';
import { AdminAuditInterceptor } from '../admin/admin-audit.interceptor';
import { ContentHubKolService } from './content-hub-kol.service';
import { MediaHubService } from '../catalog/mediahub.service';
import { KolIntelService } from './kol-intel.service';
import {
  KolMutationsService,
  type AdminKol,
  type KolHeadshotPresignResult,
  type KolRefreshResult,
} from './kol-mutations.service';
import { KolVisibilityService } from './kol-visibility.service';
import { PresignHeadshotDto, UpdateKolDto } from './dto/update-kol.dto';
import { UpdateKolVisibilityDto } from './dto/update-kol-visibility.dto';
import type { PublicKol, PublicKolList } from './kol-network.types';
import type {
  EngagementSignals,
  AdminKolPublicationList,
  OpenPayments,
  Trials,
  News,
} from './kol-intel.types';

export type AdminKolNetworkItem = PublicKol & {
  visibility: {
    visibleOnPublic: boolean;
    visibleOnApp: boolean;
  };
};

export type AdminKolNetworkList = {
  items: AdminKolNetworkItem[];
  total: number;
  institutions: string[];
};

@ApiTags('Admin')
@ApiBearerAuth()
@Controller('admin/kol-network')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@UseInterceptors(AdminAuditInterceptor)
export class AdminKolNetworkController {
  private readonly logger = new Logger(AdminKolNetworkController.name);

  constructor(
    private readonly contentHub: ContentHubKolService,
    private readonly mediahub: MediaHubService,
    private readonly visibility: KolVisibilityService,
    private readonly intel: KolIntelService,
    private readonly mutations: KolMutationsService,
    private readonly cacheClear: CacheClearService,
  ) {}

  private mapAxiosError(err: unknown): never {
    if (isAxiosError(err)) {
      const meta = axiosContentHubErrorMeta(err);
      if (meta.status === 404) {
        throw new NotFoundException(meta.message || 'KOL not found');
      }
      if (meta.status === 400) {
        throw new BadRequestException(meta.message || 'Bad request');
      }
    }
    throw err;
  }

  private async hubCall<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (err: unknown) {
      this.mapAxiosError(err);
    }
  }

  /** SCRUM-67: bust CHT's contenthub cache after any admin KOL write. */
  private async afterHubWrite(): Promise<void> {
    await this.cacheClear.clear('contenthub');
  }

  private async fetchAllKols(q?: string): Promise<PublicKolList> {
    const params = { q, limit: 500 };
    if (this.contentHub.isConfigured()) {
      try {
        return await this.contentHub.getKols(params);
      } catch (err: unknown) {
        this.logger.warn(`Admin KOL list: Content Hub failed: ${String(err)}`);
      }
    }
    if (this.mediahub.isConfigured()) {
      try {
        return await this.mediahub.getKols(params);
      } catch (err: unknown) {
        this.logger.warn(`Admin KOL list: MediaHub failed: ${String(err)}`);
      }
    }
    return { items: [], total: 0, regions: [], institutions: [] };
  }

  @Get()
  @ApiOperation({ summary: 'List KOL roster with visibility and intel analytics' })
  async list(
    @Query('q') q?: string,
  ): Promise<AdminKolNetworkList> {
    const [list, visibilityMap] = await Promise.all([
      this.fetchAllKols(q?.trim() || undefined),
      this.visibility.getVisibilityMap(),
    ]);

    const items: AdminKolNetworkItem[] = list.items.map((kol) => {
      const slug = this.visibility.resolveSlug(kol);
      const flags = this.visibility.flagsForSlug(visibilityMap, slug);
      return {
        ...kol,
        visibility: flags,
      };
    });

    items.sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }),
    );

    return {
      items,
      total: items.length,
      institutions: list.institutions ?? [],
    };
  }

  @Patch(':slug/visibility')
  @ApiOperation({ summary: 'Toggle KOL visibility on public site and/or member app' })
  @ApiParam({ name: 'slug', description: 'Content Hub KOL slug' })
  async updateVisibility(
    @Param('slug') slug: string,
    @Body() body: UpdateKolVisibilityDto,
    @CurrentUser() user: AuthUser,
  ): Promise<{ slug: string; visibility: { visibleOnPublic: boolean; visibleOnApp: boolean } }> {
    const next = await this.visibility.updateVisibility(
      slug,
      {
        visibleOnPublic: body.visibleOnPublic,
        visibleOnApp: body.visibleOnApp,
      },
      user.userId,
    );
    return { slug: slug.trim(), visibility: next };
  }

  @Get(':slug/engagement')
  @ApiOperation({ summary: 'KOL engagement signals (webinars, questions, surveys)' })
  @ApiParam({ name: 'slug', description: 'Content Hub KOL slug' })
  async engagement(@Param('slug') slug: string): Promise<EngagementSignals> {
    return this.intel.getEngagement(slug.trim());
  }

  @Get(':slug/publications')
  @ApiOperation({ summary: 'KOL publications (paginated)' })
  @ApiParam({ name: 'slug', description: 'Content Hub KOL slug' })
  async publications(
    @Param('slug') slug: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ): Promise<AdminKolPublicationList> {
    return this.intel.getPublications(slug.trim(), {
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
    });
  }

  @Get(':slug/open-payments')
  @ApiOperation({ summary: 'KOL Open Payments records + summary' })
  @ApiParam({ name: 'slug', description: 'Content Hub KOL slug' })
  async openPayments(
    @Param('slug') slug: string,
    @Query('limit') limit?: string,
  ): Promise<OpenPayments> {
    return this.intel.getOpenPayments(slug.trim(), {
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Get(':slug/trials')
  @ApiOperation({ summary: 'KOL clinical trial signals' })
  @ApiParam({ name: 'slug', description: 'Content Hub KOL slug' })
  async trials(
    @Param('slug') slug: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ): Promise<Trials> {
    return this.intel.getTrials(slug.trim(), {
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
    });
  }

  @Patch(':slug')
  @ApiOperation({ summary: 'Edit KOL admin fields (proxies to Content Hub)' })
  @ApiParam({ name: 'slug', description: 'Content Hub KOL slug' })
  async updateKol(
    @Param('slug') slug: string,
    @Body() body: UpdateKolDto,
  ): Promise<AdminKol> {
    const updated = await this.hubCall(() =>
      this.mutations.patchKol(slug.trim(), body),
    );
    await this.afterHubWrite();
    return updated;
  }

  @Post(':slug/refresh')
  @ApiOperation({ summary: 'Enqueue an HCP intel refresh for this KOL' })
  @ApiParam({ name: 'slug', description: 'Content Hub KOL slug' })
  async refreshKol(@Param('slug') slug: string): Promise<KolRefreshResult> {
    const result = await this.hubCall(() =>
      this.mutations.refreshKol(slug.trim()),
    );
    if (result.status === 'enqueued') {
      await this.afterHubWrite();
    }
    return result;
  }

  @Post(':slug/headshot/presign')
  @ApiOperation({ summary: 'Get a presigned S3 PUT URL for KOL headshot upload' })
  @ApiParam({ name: 'slug', description: 'Content Hub KOL slug' })
  async presignHeadshot(
    @Param('slug') slug: string,
    @Body() body: PresignHeadshotDto,
  ): Promise<KolHeadshotPresignResult> {
    return this.hubCall(() =>
      this.mutations.presignHeadshot(slug.trim(), body),
    );
  }

  @Get(':slug/news')
  @ApiOperation({ summary: 'KOL news article signals' })
  @ApiParam({ name: 'slug', description: 'Content Hub KOL slug' })
  async news(
    @Param('slug') slug: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ): Promise<News> {
    return this.intel.getNews(slug.trim(), {
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
    });
  }
}
