import { Module } from '@nestjs/common';
import { AuthModule } from '../../auth/auth.module';
import { CacheModule } from '../../cache/cache.module';
import { PrismaModule } from '../../prisma/prisma.module';
import { ContentHubModule } from '../content-hub/content-hub.module';
import { AdminKolNetworkController } from './admin-kol-network.controller';
import { ContentHubKolService } from './content-hub-kol.service';
import { KolIntelService } from './kol-intel.service';
import { KolMutationsService } from './kol-mutations.service';
import { KolNetworkController } from './kol-network.controller';
import { KolVisibilityService } from './kol-visibility.service';

@Module({
  imports: [AuthModule, CacheModule, PrismaModule, ContentHubModule],
  controllers: [KolNetworkController, AdminKolNetworkController],
  providers: [
    ContentHubKolService,
    KolIntelService,
    KolMutationsService,
    KolVisibilityService,
  ],
  exports: [ContentHubKolService, KolVisibilityService],
})
export class KolNetworkModule {}
