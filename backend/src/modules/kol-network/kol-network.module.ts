import { Module } from '@nestjs/common';
import { AuthModule } from '../../auth/auth.module';
import { PrismaModule } from '../../prisma/prisma.module';
import { CatalogModule } from '../catalog/catalog.module';
import { ContentHubModule } from '../content-hub/content-hub.module';
import { AdminAuditInterceptor } from '../admin/admin-audit.interceptor';
import { AdminKolNetworkController } from './admin-kol-network.controller';
import { ContentHubKolService } from './content-hub-kol.service';
import { KolIntelService } from './kol-intel.service';
import { KolNetworkController } from './kol-network.controller';
import { KolVisibilityService } from './kol-visibility.service';

@Module({
  imports: [AuthModule, PrismaModule, ContentHubModule, CatalogModule],
  controllers: [KolNetworkController, AdminKolNetworkController],
  providers: [
    ContentHubKolService,
    KolIntelService,
    KolVisibilityService,
    AdminAuditInterceptor,
  ],
  exports: [ContentHubKolService, KolVisibilityService],
})
export class KolNetworkModule {}
