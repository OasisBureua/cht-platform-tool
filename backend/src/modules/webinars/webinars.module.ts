import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ZoomService } from './zoom.service';
import { WebinarsService } from './webinars.service';
import { WebinarsController } from './webinars.controller';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [
    HttpModule.register({ timeout: 10000, maxRedirects: 5 }),
    PrismaModule,
  ],
  controllers: [WebinarsController],
  providers: [ZoomService, WebinarsService],
  exports: [WebinarsService],
})
export class WebinarsModule {}
