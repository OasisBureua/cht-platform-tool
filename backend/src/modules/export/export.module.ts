import { Module } from '@nestjs/common';
import { AuthModule } from '../../auth/auth.module';
import { ExportController } from './export.controller';

@Module({
  imports: [AuthModule],
  controllers: [ExportController],
})
export class ExportModule {}
