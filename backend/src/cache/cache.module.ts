import { Global, Module } from '@nestjs/common';
import { RedisCacheService } from './redis-cache.service';
import { CacheClearService } from './cache-clear.service';

/**
 * Global Redis + cache clear. Do not import AuthModule here — that creates
 * AppModule → CacheModule → AuthModule → OutboundSync → ContentHub → AuthModule.
 * CacheClearService resolves CognitoService via ModuleRef at auth time.
 */
@Global()
@Module({
  providers: [RedisCacheService, CacheClearService],
  exports: [RedisCacheService, CacheClearService],
})
export class CacheModule {}
