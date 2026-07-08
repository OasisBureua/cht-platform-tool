import { Controller, Get } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { JotformService } from './jotform.service';

/**
 * Jotform connectivity test.
 * GET /api/jotform/test - verifies API key and base URL.
 */
@SkipThrottle()
@Controller('jotform')
export class JotformController {
  constructor(private readonly jotformService: JotformService) {}

  @Get('test')
  async testConnection() {
    return this.jotformService.testConnection();
  }
}
