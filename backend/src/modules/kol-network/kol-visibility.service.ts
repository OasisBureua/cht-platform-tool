import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { PublicKol, PublicKolList } from './kol-network.types';

export type KolDirectorySurface = 'public' | 'app';

export type KolVisibilityFlags = {
  visibleOnPublic: boolean;
  visibleOnApp: boolean;
};

const DEFAULT_VISIBILITY: KolVisibilityFlags = {
  visibleOnPublic: true,
  visibleOnApp: true,
};

@Injectable()
export class KolVisibilityService {
  constructor(private readonly prisma: PrismaService) {}

  resolveSlug(kol: Pick<PublicKol, 'slug' | 'id'>): string {
    return (kol.slug || kol.id).trim();
  }

  async getVisibilityMap(): Promise<Map<string, KolVisibilityFlags>> {
    const rows = await this.prisma.kolDirectoryVisibility.findMany();
    return new Map(
      rows.map((row) => [
        row.slug,
        {
          visibleOnPublic: row.visibleOnPublic,
          visibleOnApp: row.visibleOnApp,
        },
      ]),
    );
  }

  flagsForSlug(
    map: Map<string, KolVisibilityFlags>,
    slug: string,
  ): KolVisibilityFlags {
    return map.get(slug) ?? DEFAULT_VISIBILITY;
  }

  isVisibleOnSurface(
    flags: KolVisibilityFlags,
    surface: KolDirectorySurface,
  ): boolean {
    return surface === 'app' ? flags.visibleOnApp : flags.visibleOnPublic;
  }

  filterKolList(
    list: PublicKolList,
    surface: KolDirectorySurface,
    visibility: Map<string, KolVisibilityFlags>,
  ): PublicKolList {
    const items = list.items.filter((kol) => {
      const slug = this.resolveSlug(kol);
      const flags = this.flagsForSlug(visibility, slug);
      return this.isVisibleOnSurface(flags, surface);
    });

    const regionCounts = new Map<string, number>();
    for (const kol of items) {
      if (!kol.region) continue;
      regionCounts.set(kol.region, (regionCounts.get(kol.region) ?? 0) + 1);
    }

    const regions = list.regions
      .map((region) => ({
        ...region,
        kol_count: regionCounts.get(region.slug) ?? 0,
      }))
      .filter((region) => region.kol_count > 0);

    const institutions = [
      ...new Set(
        items
          .map((kol) => kol.institution?.trim())
          .filter((value): value is string => Boolean(value)),
      ),
    ].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));

    return {
      items,
      total: items.length,
      regions,
      institutions,
    };
  }

  async isKolVisible(
    kol: Pick<PublicKol, 'slug' | 'id'>,
    surface: KolDirectorySurface,
  ): Promise<boolean> {
    const slug = this.resolveSlug(kol);
    const row = await this.prisma.kolDirectoryVisibility.findUnique({
      where: { slug },
    });
    const flags = row
      ? {
          visibleOnPublic: row.visibleOnPublic,
          visibleOnApp: row.visibleOnApp,
        }
      : DEFAULT_VISIBILITY;
    return this.isVisibleOnSurface(flags, surface);
  }

  async updateVisibility(
    slug: string,
    patch: Partial<KolVisibilityFlags>,
    updatedByUserId?: string,
  ): Promise<KolVisibilityFlags> {
    const normalized = slug.trim();
    const existing = await this.prisma.kolDirectoryVisibility.findUnique({
      where: { slug: normalized },
    });
    const next: KolVisibilityFlags = {
      visibleOnPublic:
        patch.visibleOnPublic ??
        existing?.visibleOnPublic ??
        DEFAULT_VISIBILITY.visibleOnPublic,
      visibleOnApp:
        patch.visibleOnApp ??
        existing?.visibleOnApp ??
        DEFAULT_VISIBILITY.visibleOnApp,
    };

    const row = await this.prisma.kolDirectoryVisibility.upsert({
      where: { slug: normalized },
      create: {
        slug: normalized,
        visibleOnPublic: next.visibleOnPublic,
        visibleOnApp: next.visibleOnApp,
        updatedByUserId: updatedByUserId ?? null,
      },
      update: {
        visibleOnPublic: next.visibleOnPublic,
        visibleOnApp: next.visibleOnApp,
        updatedByUserId: updatedByUserId ?? null,
      },
    });

    return {
      visibleOnPublic: row.visibleOnPublic,
      visibleOnApp: row.visibleOnApp,
    };
  }
}
