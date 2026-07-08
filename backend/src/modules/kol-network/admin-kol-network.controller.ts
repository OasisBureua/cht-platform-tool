import {
  Body,
  Controller,
  Get,
  Logger,
  Param,
  Patch,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
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
import { AdminAuditInterceptor } from '../admin/admin-audit.interceptor';
import { ContentHubKolService } from './content-hub-kol.service';
import { MediaHubService } from '../catalog/mediahub.service';
import { KolVisibilityService } from './kol-visibility.service';
import { UpdateKolVisibilityDto } from './dto/update-kol-visibility.dto';
import type { PublicKol, PublicKolList } from './kol-network.types';

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
  ) {}

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
}
