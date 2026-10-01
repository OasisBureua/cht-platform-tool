import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { CatalogController } from './catalog.controller';
import { CatalogService } from './catalog.service';
import { ContentHubCatalogService } from './contenthub-catalog.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { CacheModule } from '../../cache/cache.module';
import { AuthModule } from '../../auth/auth.module';

@Module({
  imports: [
    HttpModule.register({
      timeout: 10000,
      maxRedirects: 5,
    }),
    PrismaModule,
    CacheModule,
    AuthModule,
  ],
  controllers: [CatalogController],
  providers: [CatalogService, ContentHubCatalogService],
  exports: [CatalogService, ContentHubCatalogService],
})
export class CatalogModule {}
