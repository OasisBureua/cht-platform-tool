import { Module } from '@nestjs/common';
import { AuthModule } from '../../auth/auth.module';
import { PrismaModule } from '../../prisma/prisma.module';
import { JotformModule } from '../jotform/jotform.module';
import { ExportController } from './export.controller';
import { ExportService } from './export.service';

@Module({
  imports: [AuthModule, PrismaModule, JotformModule],
  controllers: [ExportController],
  providers: [ExportService],
})
export class ExportModule {}
