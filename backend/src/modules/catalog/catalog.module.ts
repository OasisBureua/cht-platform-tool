import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { CatalogController } from './catalog.controller';
import { CatalogService } from './catalog.service';
import { MediaHubService } from './mediahub.service';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [
    HttpModule.register({
      timeout: 10000,
      maxRedirects: 5,
    }),
    PrismaModule,
  ],
  controllers: [CatalogController],
  providers: [CatalogService, MediaHubService],
  exports: [CatalogService, MediaHubService],
})
export class CatalogModule {}
