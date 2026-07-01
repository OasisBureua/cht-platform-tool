import { Module } from '@nestjs/common';
import { CatalogModule } from '../catalog/catalog.module';
import { ContentHubModule } from '../content-hub/content-hub.module';
import { ContentHubKolService } from './content-hub-kol.service';
import { KolNetworkController } from './kol-network.controller';

@Module({
  imports: [ContentHubModule, CatalogModule],
  controllers: [KolNetworkController],
  providers: [ContentHubKolService],
})
export class KolNetworkModule {}
