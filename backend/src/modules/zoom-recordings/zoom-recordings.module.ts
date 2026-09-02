import { Module } from '@nestjs/common';
import { AuthModule } from '../../auth/auth.module';
import { PrismaModule } from '../../prisma/prisma.module';
import { ProgramsModule } from '../programs/programs.module';
import { WebinarsModule } from '../webinars/webinars.module';
import { AdminZoomRecordingsController } from './admin-zoom-recordings.controller';
import { ChmContentIdService } from './chm-content-id.service';
import { ZoomRecordingsCatalogService } from './zoom-recordings-catalog.service';
import { ZoomRecordingsPullService } from './zoom-recordings-pull.service';
import { ZoomRecordingsSessionService } from './zoom-recordings-session.service';
import { ZoomRecordingsStorageService } from './zoom-recordings-storage.service';
import { ZoomRecordingsSyncService } from './zoom-recordings-sync.service';
import { ZoomAttendanceImportService } from './zoom-attendance-import.service';
import { ZoomAttendanceReportExportService } from './zoom-attendance-report-export.service';

@Module({
  imports: [AuthModule, PrismaModule, WebinarsModule, ProgramsModule],
  controllers: [AdminZoomRecordingsController],
  providers: [
    ChmContentIdService,
    ZoomRecordingsStorageService,
    ZoomRecordingsSessionService,
    ZoomRecordingsPullService,
    ZoomRecordingsSyncService,
    ZoomRecordingsCatalogService,
    ZoomAttendanceReportExportService,
    ZoomAttendanceImportService,
  ],
  exports: [
    ChmContentIdService,
    ZoomRecordingsStorageService,
    ZoomRecordingsSessionService,
    ZoomRecordingsPullService,
    ZoomRecordingsSyncService,
    ZoomRecordingsCatalogService,
    ZoomAttendanceReportExportService,
    ZoomAttendanceImportService,
  ],
})
export class ZoomRecordingsModule {}
