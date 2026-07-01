import { Module } from '@nestjs/common';
import { InternalCacheController } from './internal-cache.controller';

@Module({
  controllers: [InternalCacheController],
})
export class InternalModule {}
