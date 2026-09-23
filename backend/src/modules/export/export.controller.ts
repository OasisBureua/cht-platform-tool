import {
  BadRequestException,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
  NotImplementedException,
  Param,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { CognitoM2mAuthGuard } from '../../auth/cognito-m2m-auth.guard';

/**
 * S2S export surfaces for Content Hub ingest.
 * Auth: Cognito M2M only (platform/export.read). Not session JWT.
 */
@ApiTags('export')
@Controller('export')
@UseGuards(CognitoM2mAuthGuard)
@ApiBearerAuth('m2m-access-token')
@ApiHeader({
  name: 'X-Request-Id',
  required: true,
  description: 'Correlation id from Hub; echoed on the response',
})
export class ExportController {
  private readonly logger = new Logger(ExportController.name);

  @Get('reports/campaigns/:campaignId/input-packet')
  @HttpCode(HttpStatus.NOT_IMPLEMENTED)
  @ApiOperation({
    summary: 'Campaign input packet for Hub ingest (stub)',
    description:
      'Requires Cognito M2M scope platform/export.read. Packet body lands in a follow-on ticket.',
  })
  getCampaignInputPacket(
    @Param('campaignId') campaignId: string,
    @Req()
    req: Request & {
      m2m?: { clientId: string; scope: string; sub: string };
    },
    @Res({ passthrough: true }) res: Response,
  ): never {
    let requestId: string;
    try {
      requestId = requireRequestId(req);
    } catch (err) {
      this.logger.warn(
        `[export] input-packet reject reason=missing_request_id campaignId=${campaignId} clientId=${req.m2m?.clientId || '-'}`,
      );
      throw err;
    }
    res.setHeader('X-Request-Id', requestId);

    this.logger.log(
      `[export] input-packet stub=501 campaignId=${campaignId} clientId=${req.m2m?.clientId || '-'} requestId=${requestId}`,
    );

    throw new NotImplementedException({
      message: 'Export input-packet is not implemented yet',
      campaignId,
      requestId,
    });
  }
}

function requireRequestId(req: Request): string {
  const incoming = req.headers['x-request-id'];
  const fromHeader =
    typeof incoming === 'string'
      ? incoming.trim()
      : Array.isArray(incoming)
        ? (incoming.find((v) => typeof v === 'string' && v.trim()) || '').trim()
        : '';
  if (!fromHeader) {
    throw new BadRequestException('X-Request-Id header is required');
  }
  return fromHeader;
}
