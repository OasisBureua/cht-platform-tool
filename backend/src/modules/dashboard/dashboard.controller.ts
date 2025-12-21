import { Controller, Get, Param, Logger } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { EarningsResponseDto } from './dto/earnings-response.dto';
import { StatsResponseDto } from './dto/stats-response.dto';

@Controller('dashboard')
export class DashboardController {
    private readonly logger = new Logger(DashboardController.name);

    constructor(private readonly dashboardService: DashboardService) {}

    /**
    * GET /api/dashboard/:userId/earnings
    * Get user's earnings breakdown
    */
    @Get(':userId/earnings')
    async getEarnings(@Param('userId') userId: string): Promise<EarningsResponseDto> {
        this.logger.log(`Getting earnings for user: ${userId}`);
        return this.dashboardService.getEarnings(userId);
    }

    /**
    * GET /api/dashboard/:userId/stats
    * Get user's activity statistics
    */
    @Get(':userId/stats')
    async getStats(@Param('userId') userId: string): Promise<StatsResponseDto> {
        this.logger.log(`Getting stats for user: ${userId}`);
        return this.dashboardService.getStats(userId);
    }
}