import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ZoomService } from '../webinars/zoom.service';
import { ZoomRecordingsPullService } from '../zoom-recordings/zoom-recordings-pull.service';
import { ZoomRecordingsStorageService } from '../zoom-recordings/zoom-recordings-storage.service';
import { extForFile } from '../zoom-recordings/zoom-recordings-media.util';

export {
  extForFile,
  contentTypeFor,
  inlineContentType,
} from '../zoom-recordings/zoom-recordings-media.util';

export type { RecordingUrlDisposition } from '../zoom-recordings/zoom-recordings-media.util';

/** Program Hub facade — delegates to shared zoom-recordings services. */
@Injectable()
export class ProgramZoomRecordingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly zoom: ZoomService,
    private readonly pullService: ZoomRecordingsPullService,
    private readonly storage: ZoomRecordingsStorageService,
  ) {}

  isStorageConfigured(): boolean {
    return this.storage.isStorageConfigured();
  }

  async list(programId: string) {
    const program = await this.prisma.program.findUnique({
      where: { id: programId },
      select: { id: true },
    });
    if (!program) throw new NotFoundException('Program not found');

    const rows = await this.prisma.zoomRecordingFile.findMany({
      where: { programId },
      orderBy: [{ recordingStart: 'desc' }, { pulledAt: 'desc' }],
    });

    return {
      storageConfigured: this.isStorageConfigured(),
      zoomConfigured: this.zoom.isConfigured(),
      recordings: rows.map((r) => this.pullService.toDto(r)),
    };
  }

  async pull(
    programId: string,
    opts: { zoomMeetingId?: string; adminUserId?: string },
  ) {
    const result = await this.pullService.pullForProgram(programId, opts);
    const list = await this.list(programId);
    return {
      ...list,
      pulledCount: result.upserted.length,
      zoomMeetingId: result.zoomMeetingId,
      topic: result.topic,
      errors: result.errors.length ? result.errors : undefined,
    };
  }

  async createDownloadUrl(
    programId: string,
    recordingId: string,
    opts?: { disposition?: import('../zoom-recordings/zoom-recordings-media.util').RecordingUrlDisposition },
  ) {
    const row = await this.prisma.zoomRecordingFile.findFirst({
      where: { id: recordingId, programId },
    });
    if (!row) throw new NotFoundException('Recording not found');
    if (!row.s3Bucket || !row.s3Key) {
      throw new BadRequestException(
        'Recording file is not stored in S3 yet. Pull from Zoom first.',
      );
    }

    const presigned = await this.storage.createPresignedDownloadUrl({
      bucket: row.s3Bucket,
      key: row.s3Key,
      fileType: row.fileType,
      fileExtension: row.fileExtension || extForFile(row.fileType, row.fileExtension),
      zoomRecordingFileId: row.zoomRecordingFileId,
      chmAssetFilename: row.chmAssetFilename,
      disposition: opts?.disposition,
    });

    return {
      ...presigned,
      recording: this.pullService.toDto(row),
    };
  }
}
