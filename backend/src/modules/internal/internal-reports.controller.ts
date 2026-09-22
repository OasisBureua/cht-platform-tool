import { Controller, Get, Headers, Logger, NotFoundException, Param } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ProgramRegistrationsService } from '../programs/program-registrations.service';
import { InternalReportsAuthService } from './internal-reports-auth.service';

/**
 * Service-to-service read access for cht-reports' report-packet
 * pipeline. Same registration data as
 * admin/programs/:id/registrations (see admin.controller.ts), which is
 * JwtAuthGuard-gated for human admins only. This is a separate route
 * rather than a second guard on that one, mirroring
 * InternalCacheController's existing internal/cache/* pattern:
 * service-to-service auth stays out of the human-session guard chain.
 *
 * GET /internal/programs/:id/registrations
 * Header: X-BFF-Auth: <INTERNAL_REPORTS_SECRET>
 */
@Controller('internal/programs')
export class InternalReportsController {
  private readonly logger = new Logger(InternalReportsController.name);

  constructor(
    private readonly auth: InternalReportsAuthService,
    private readonly prisma: PrismaService,
    private readonly programRegistrations: ProgramRegistrationsService,
  ) {}

  @Get(':id/registrations')
  async listRegistrations(
    @Param('id') id: string,
    @Headers('x-bff-auth') bffAuth?: string,
  ) {
    this.auth.assertBffAuth(bffAuth);

    const exists = await this.prisma.program.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!exists) throw new NotFoundException('Program not found');

    const rows = await this.programRegistrations.listRegistrationsForAdmin(id);
    this.logger.log(`GET /internal/programs/${id}/registrations count=${rows.length}`);
    return {
      registrations: rows.map((r) => ({
        id: r.id,
        status: r.status,
        user: r.user,
        postEventAttendanceStatus: r.postEventAttendanceStatus,
      })),
    };
  }
}
