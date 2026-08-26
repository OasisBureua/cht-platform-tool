import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { HttpModule } from '@nestjs/axios';
import { HealthController } from './health.controller';
import { ActuatorController } from './actuator.controller';
import { PrismaHealthIndicator } from './prisma.health';
import { AppInfoService } from './app-info.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [TerminusModule, HttpModule, PrismaModule],
  controllers: [HealthController, ActuatorController],
  providers: [PrismaHealthIndicator, AppInfoService],
})
export class HealthModule {}
