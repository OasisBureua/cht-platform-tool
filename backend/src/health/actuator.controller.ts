import { Controller, Get } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { AppInfoService } from './app-info.service';

@SkipThrottle()
@Controller('actuator')
export class ActuatorController {
  constructor(private readonly appInfo: AppInfoService) {}

  /**
   * Deployment metadata for ops / DR verification (Spring Boot–style path).
   * GET /actuator/info
   */
  @Get('info')
  info() {
    return this.appInfo.getInfo();
  }
}
