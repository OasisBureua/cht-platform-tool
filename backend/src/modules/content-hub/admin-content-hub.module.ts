import { Module } from '@nestjs/common';
import { AuthModule } from '../../auth/auth.module';
import { CacheModule } from '../../cache/cache.module';
import { HubSpotModule } from '../hubspot/hubspot.module';
import { WebinarsModule } from '../webinars/webinars.module';
import { AdminContentHubController } from './admin-content-hub.controller';
import { ContentHubModule } from './content-hub.module';

@Module({
  imports: [
    AuthModule,
    CacheModule,
    ContentHubModule,
    HubSpotModule,
    WebinarsModule,
  ],
  controllers: [AdminContentHubController],
  exports: [ContentHubModule],
})
export class AdminContentHubModule {}
