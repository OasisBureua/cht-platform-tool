import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RolesGuard } from '../../auth/roles.guard';
import { Roles } from '../../auth/roles.decorator';
import {
  CampaignsDashboardService,
  type CampaignsDashboardQuery,
} from './campaigns-dashboard.service';

@ApiTags('Admin')
@ApiBearerAuth()
@Controller('admin/campaigns')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminCampaignsController {
  constructor(private readonly dashboard: CampaignsDashboardService) {}

  @Get('dashboard')
  @ApiOperation({
    summary: 'HubSpot campaign metrics dashboard (live pull + Content Hub links)',
  })
  async getDashboard(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('limit') limit?: string,
  ) {
    const query: CampaignsDashboardQuery = {
      startDate: startDate?.trim() || undefined,
      endDate: endDate?.trim() || undefined,
      limit: limit ? Number(limit) : undefined,
    };
    return this.dashboard.getDashboard(query);
  }
}
