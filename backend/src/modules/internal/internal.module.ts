import { Module } from '@nestjs/common';
import { InternalCacheController } from './internal-cache.controller';
import { InternalReportsController } from './internal-reports.controller';
import { InternalReportsAuthService } from './internal-reports-auth.service';
import { CacheModule } from '../../cache/cache.module';
import { ProgramsModule } from '../programs/programs.module';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [CacheModule, ProgramsModule, PrismaModule],
  controllers: [InternalCacheController, InternalReportsController],
  providers: [InternalReportsAuthService],
})
export class InternalModule {}
