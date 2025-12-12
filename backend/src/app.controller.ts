import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { Public } from './auth/decorators/public.decorator';
import { CurrentUser } from './auth/decorators/current-user.decorator';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('health')
  @Public() // <- No auth required for health checks
  health() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('me')
  getCurrentUser(@CurrentUser() user: any) {
    return {
      message: 'Authenticated user',
      user
    };
  }
}
