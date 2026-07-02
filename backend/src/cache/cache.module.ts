import { Global, Module } from '@nestjs/common';
import { RedisCacheService } from './redis-cache.service';
import { CacheClearService } from './cache-clear.service';

@Global()
@Module({
  providers: [RedisCacheService, CacheClearService],
  exports: [RedisCacheService, CacheClearService],
})
export class CacheModule {}
