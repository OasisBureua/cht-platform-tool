import { Module } from '@nestjs/common';
import { CatalogModule } from '../catalog/catalog.module';
import { KolNetworkController } from './kol-network.controller';

/**
 * KOL Network module — re-exports MediaHubService via CatalogModule so we
 * share a single HttpModule + connection pool with the catalog endpoints.
 */
@Module({
  imports: [CatalogModule],
  controllers: [KolNetworkController],
})
export class KolNetworkModule {}
