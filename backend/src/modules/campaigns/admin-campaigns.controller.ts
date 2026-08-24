import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RolesGuard } from '../../auth/roles.guard';
import { Roles } from '../../auth/roles.decorator';
import {
  CampaignsDashboardService,
  type CampaignsDashboardQuery,
} from './campaigns-dashboard.service';
import { CampaignsFunnelService } from './campaigns-funnel.service';
import type {
  CampaignsFunnelPeopleQuery,
  CampaignsFunnelQuery,
  FunnelStageKey,
} from './campaigns-funnel.types';

@ApiTags('Admin')
@ApiBearerAuth()
@Controller('admin/campaigns')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminCampaignsController {
  constructor(
    private readonly dashboard: CampaignsDashboardService,
    private readonly funnel: CampaignsFunnelService,
  ) {}

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

  @Get('funnel')
  @ApiOperation({
    summary:
      'Sales funnel stage counts, drop-off, and filters (HubSpot + CHT aggregation)',
  })
  async getFunnel(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('campaignId') campaignId?: string,
    @Query('clientSponsor') clientSponsor?: string,
    @Query('programId') programId?: string,
  ) {
    const query: CampaignsFunnelQuery = {
      startDate: startDate?.trim() || undefined,
      endDate: endDate?.trim() || undefined,
      campaignId: campaignId?.trim() || undefined,
      clientSponsor: clientSponsor?.trim() || undefined,
      programId: programId?.trim() || undefined,
    };
    return this.funnel.getFunnel(query);
  }

  @Get('funnel/people')
  @ApiOperation({
    summary:
      'People in a funnel stage (CHT Registered/Attended/Converted; HubSpot stages are count-only)',
  })
  async getFunnelPeople(
    @Query('stage') stage?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('campaignId') campaignId?: string,
    @Query('clientSponsor') clientSponsor?: string,
    @Query('programId') programId?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const query: CampaignsFunnelPeopleQuery = {
      stage: stage?.trim() as FunnelStageKey,
      startDate: startDate?.trim() || undefined,
      endDate: endDate?.trim() || undefined,
      campaignId: campaignId?.trim() || undefined,
      clientSponsor: clientSponsor?.trim() || undefined,
      programId: programId?.trim() || undefined,
      limit: limit != null && limit !== '' ? Number(limit) : undefined,
      offset: offset != null && offset !== '' ? Number(offset) : undefined,
    };
    return this.funnel.getPeople(query);
  }

  @Get('funnel/hcp/:userId')
  @ApiOperation({
    summary:
      'HCP drill-down: HubSpot match (email then NPI), last campaign, CHT activity',
  })
  getFunnelHcp(@Param('userId') userId: string) {
    return this.funnel.getHcp(userId);
  }
}
