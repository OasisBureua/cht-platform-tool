import { Controller, Get, Patch, Param, Body, Logger, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { CheckUserGuard } from '../../auth/check-user.guard';
import { DashboardService } from './dashboard.service';
import { EarningsResponseDto } from './dto/earnings-response.dto';
import { StatsResponseDto } from './dto/stats-response.dto';
import { ProfileResponseDto } from './dto/profile-response.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';

@Controller('dashboard')
@UseGuards(JwtAuthGuard, CheckUserGuard)
export class DashboardController {
  private readonly logger = new Logger(DashboardController.name);

  constructor(private readonly dashboardService: DashboardService) {}

  /**
   * GET /api/dashboard/:userId/earnings
   * Get user's earnings breakdown (auth required)
   */
  @Get(':userId/earnings')
  async getEarnings(@Param('userId') userId: string): Promise<EarningsResponseDto> {
    this.logger.log(`Getting earnings for user: ${userId}`);
    return this.dashboardService.getEarnings(userId);
  }

  /**
   * GET /api/dashboard/:userId/stats
   * Get user's activity statistics (auth required)
   */
  @Get(':userId/stats')
  async getStats(@Param('userId') userId: string): Promise<StatsResponseDto> {
    this.logger.log(`Getting stats for user: ${userId}`);
    return this.dashboardService.getStats(userId);
  }

  /**
   * GET /api/dashboard/:userId/profile
   * Get user profile for Settings page (auth required)
   */
  @Get(':userId/profile')
  async getProfile(@Param('userId') userId: string): Promise<ProfileResponseDto> {
    this.logger.log(`Getting profile for user: ${userId}`);
    return this.dashboardService.getProfile(userId);
  }

  /**
   * PATCH /api/dashboard/:userId/profile
   * Update user profile (firstName, lastName only for now)
   */
  @Patch(':userId/profile')
  async updateProfile(
    @Param('userId') userId: string,
    @Body() dto: UpdateProfileDto,
  ): Promise<ProfileResponseDto> {
    this.logger.log(`Updating profile for user: ${userId}`);
    return this.dashboardService.updateProfile(userId, {
      firstName: dto.firstName,
      lastName: dto.lastName,
    });
  }
}