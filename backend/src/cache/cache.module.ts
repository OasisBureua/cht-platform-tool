import { Global, Module, forwardRef } from '@nestjs/common';
import { RedisCacheService } from './redis-cache.service';
import { CacheClearService } from './cache-clear.service';
import { AuthModule } from '../auth/auth.module';

@Global()
@Module({
  imports: [forwardRef(() => AuthModule)],
  providers: [RedisCacheService, CacheClearService],
  exports: [RedisCacheService, CacheClearService],
})
export class CacheModule {}
