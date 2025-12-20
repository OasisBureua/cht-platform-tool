import { Controller, Get, UseGuards, Request } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { Public } from '../../auth/decorators/public.decorator';

@Controller('dashboard')
@UseGuards(JwtAuthGuard) // Will protect when Auth0 is set up
export class DashboardController {
    constructor(private readonly dashboardService: DashboardService) {}
    
    /**
     * GET /dashboard/earnings
     * Get user's earnings breakdown
     */
    @Get('earnings')
    @Public() // TODO: Remove when Auth0 is set up
    async getEarnings(@Request() req) {
        // TODO: Get userId from req.user.userId after Auth0 is configured
        // For now, get from test user
        const userId = 'cmjdk4k1g0000mpho6zt1y57g'; // Replace with your test user ID
        return this.dashboardService.getEarnings(userId);
    }

    /**
   * GET /dashboard/stats
   * Get user's activity statistics
   */
    @Get('stats')
    @Public() // TODO: Remove after Auth0 is set up
    async getStats(@Request() req) {
        // TODO: Get userId from req.user.userId after Auth0 is configured
        const userId = 'cmjdk4k1g0000mpho6zt1y57g'; // Replace with your test user ID
        return this.dashboardService.getStats(userId);
    }
}