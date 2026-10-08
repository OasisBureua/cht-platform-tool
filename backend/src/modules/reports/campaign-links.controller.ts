import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RolesGuard } from '../../auth/roles.guard';
import { Roles } from '../../auth/roles.decorator';
import { CampaignExportIngestService } from '../content-hub/campaign-export-ingest.service';
import { PrismaService } from '../../prisma/prisma.service';
import { LinkCampaignDto } from './dto/link-campaign.dto';

const PROGRAM_LINK_SELECT = {
  id: true,
  title: true,
  status: true,
  startDate: true,
  zoomSessionType: true,
  chmProgramId: true,
  campaignId: true,
} as const;

export type CampaignLinkProgram = {
  id: string;
  title: string;
  status: string;
  startDate: string | null;
  zoomSessionType: string;
  chmProgramId: string | null;
  campaignId: string | null;
};

/**
 * Program → Hub campaign link for Cross-Platform Reporting. Updates only
 * Program.campaignId, so linking never touches Zoom or survey attachment.
 */
@ApiTags('Reports')
@ApiBearerAuth('session-token')
@Controller('admin/campaign-links')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class CampaignLinksController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly exportIngest: CampaignExportIngestService,
  ) {}

  @Get('programs')
  @ApiOperation({
    summary: 'Programs with their Hub campaign link (newest first)',
  })
  async listPrograms(): Promise<CampaignLinkProgram[]> {
    const programs = await this.prisma.program.findMany({
      select: PROGRAM_LINK_SELECT,
      orderBy: [{ startDate: 'desc' }, { createdAt: 'desc' }],
    });
    return programs.map(toLinkProgram);
  }

  @Patch('programs/:id')
  @ApiOperation({
    summary:
      'Link or unlink a Program to a Hub campaign (triggers Hub export-ingest)',
  })
  async linkProgram(
    @Param('id') id: string,
    @Body() body: LinkCampaignDto,
  ): Promise<CampaignLinkProgram> {
    const exists = await this.prisma.program.findUnique({
      where: { id },
      select: { id: true, campaignId: true },
    });
    if (!exists) throw new NotFoundException('Program not found');

    const nextCampaignId = body.campaignId?.trim() || null;
    const updated = await this.prisma.program.update({
      where: { id },
      data: { campaignId: nextCampaignId },
      select: PROGRAM_LINK_SELECT,
    });

    // CPR-41 — refresh warehouse for previous and/or new campaign (async).
    this.exportIngest.triggerForProgramLink({
      previousCampaignId: exists.campaignId,
      nextCampaignId,
    });

    return toLinkProgram(updated);
  }
}

function toLinkProgram(p: {
  id: string;
  title: string;
  status: string;
  startDate: Date | null;
  zoomSessionType: string;
  chmProgramId: string | null;
  campaignId: string | null;
}): CampaignLinkProgram {
  return {
    id: p.id,
    title: p.title,
    status: p.status,
    startDate: p.startDate?.toISOString() ?? null,
    zoomSessionType: p.zoomSessionType,
    chmProgramId: p.chmProgramId ?? null,
    campaignId: p.campaignId ?? null,
  };
}
