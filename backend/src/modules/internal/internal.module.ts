import { Module } from '@nestjs/common';
import { InternalCacheController } from './internal-cache.controller';
import { CacheModule } from '../../cache/cache.module';

@Module({
  imports: [CacheModule],
  controllers: [InternalCacheController],
})
export class InternalModule {}
