import { Module } from '@nestjs/common';
import { PodcastsController } from './podcasts.controller';
import { CatalogModule } from '../catalog/catalog.module';

@Module({
  imports: [CatalogModule],
  controllers: [PodcastsController],
})
export class PodcastsModule {}
