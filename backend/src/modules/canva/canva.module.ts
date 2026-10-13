import { Module } from '@nestjs/common';
import { AuthModule } from '../../auth/auth.module';
import { CanvaCallbackController, CanvaController } from './canva.controller';
import { CanvaService } from './canva.service';

@Module({
  imports: [AuthModule],
  controllers: [CanvaController, CanvaCallbackController],
  providers: [CanvaService],
})
export class CanvaModule {}
