import { Module, forwardRef } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { AuthModule } from '../../auth/auth.module';
import { CacheModule } from '../../cache/cache.module';
import { ContentHubClientService } from './content-hub-client.service';

@Module({
  imports: [
    forwardRef(() => AuthModule),
    CacheModule,
    HttpModule.register({
      timeout: 15000,
      maxRedirects: 5,
    }),
  ],
  providers: [ContentHubClientService],
  exports: [ContentHubClientService],
})
export class ContentHubModule {}
