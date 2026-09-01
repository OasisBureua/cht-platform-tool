import {
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import {
  contentTypeFor,
  extForFile,
  inlineContentType,
  ProgramZoomRecordingsService,
} from './program-zoom-recordings.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ZoomService } from '../webinars/zoom.service';
import { ZoomRecordingsPullService } from '../zoom-recordings/zoom-recordings-pull.service';
import { ZoomRecordingsStorageService } from '../zoom-recordings/zoom-recordings-storage.service';

const mockGetSignedUrl = jest.fn();

jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: (...args: unknown[]) => mockGetSignedUrl(...args),
}));

jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn().mockImplementation(() => ({ send: jest.fn() })),
  PutObjectCommand: jest.fn(),
  GetObjectCommand: jest.fn().mockImplementation((input: unknown) => ({ input })),
}));

describe('extForFile / contentTypeFor', () => {
  it('maps TRANSCRIPT and CC to vtt', () => {
    expect(extForFile('TRANSCRIPT', null)).toBe('vtt');
    expect(extForFile('CC', 'VTT')).toBe('vtt');
    expect(contentTypeFor('TRANSCRIPT', 'vtt')).toBe('text/vtt');
  });

  it('maps MP4 video separately from transcripts', () => {
    expect(extForFile('MP4', 'MP4')).toBe('mp4');
    expect(contentTypeFor('MP4', 'mp4')).toBe('video/mp4');
  });

  it('uses text/plain for inline transcript viewing', () => {
    expect(inlineContentType('TRANSCRIPT', 'vtt')).toBe(
      'text/plain; charset=utf-8',
    );
    expect(inlineContentType('MP4', 'mp4')).toBe('video/mp4');
  });
});

describe('ProgramZoomRecordingsService', () => {
  const program = {
    id: 'seed-program-1',
    title: 'Webinar Test',
    zoomMeetingId: '83768449108',
  };

  let prisma: {
    program: { findUnique: jest.Mock };
    zoomRecordingFile: {
      findMany: jest.Mock;
      findFirst: jest.Mock;
    };
  };
  let zoom: { isConfigured: jest.Mock };
  let pull: {
    pullForProgram: jest.Mock;
    toDto: jest.Mock;
  };
  let storage: {
    isStorageConfigured: jest.Mock;
    createPresignedDownloadUrl: jest.Mock;
  };
  let service: ProgramZoomRecordingsService;

  const recordingRow = {
    id: 'row-1',
    programId: program.id,
    zoomMeetingId: program.zoomMeetingId,
    zoomRecordingFileId: 'tr-1',
    fileType: 'TRANSCRIPT',
    recordingType: 'audio_transcript',
    fileExtension: 'vtt',
    fileSizeBytes: 678,
    s3Bucket: 'cht-platform-session-assets',
    s3Key: 'zoom-recordings/a/b/c.vtt',
    recordingStart: null,
    recordingEnd: null,
    topic: program.title,
    pulledAt: new Date(),
    pulledByUserId: null,
    chmAssetFilename: null,
  };

  beforeEach(() => {
    mockGetSignedUrl.mockReset();
    prisma = {
      program: { findUnique: jest.fn() },
      zoomRecordingFile: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn(),
      },
    };
    zoom = { isConfigured: jest.fn().mockReturnValue(true) };
    pull = {
      pullForProgram: jest.fn(),
      toDto: jest.fn((r) => ({
        id: r.id,
        programId: r.programId,
        zoomMeetingId: r.zoomMeetingId,
        zoomRecordingFileId: r.zoomRecordingFileId,
        fileType: r.fileType,
        recordingType: r.recordingType,
        fileExtension: r.fileExtension,
        fileSizeBytes: r.fileSizeBytes,
        topic: r.topic,
        recordingStart: null,
        recordingEnd: null,
        pulledAt: r.pulledAt?.toISOString?.() ?? null,
        pulledByUserId: r.pulledByUserId,
      })),
    };
    storage = {
      isStorageConfigured: jest.fn().mockReturnValue(true),
      createPresignedDownloadUrl: jest.fn().mockResolvedValue({
        url: 'https://s3.example/presigned',
        expiresInSeconds: 900,
      }),
    };
    service = new ProgramZoomRecordingsService(
      prisma as unknown as PrismaService,
      zoom as unknown as ZoomService,
      pull as unknown as ZoomRecordingsPullService,
      storage as unknown as ZoomRecordingsStorageService,
    );
  });

  it('lists stored rows for a program', async () => {
    prisma.program.findUnique.mockResolvedValue({ id: program.id });
    prisma.zoomRecordingFile.findMany.mockResolvedValue([recordingRow]);

    const result = await service.list(program.id);
    expect(result.zoomConfigured).toBe(true);
    expect(result.storageConfigured).toBe(true);
    expect(result.recordings[0]?.fileType).toBe('TRANSCRIPT');
  });

  it('delegates pull to ZoomRecordingsPullService', async () => {
    pull.pullForProgram.mockResolvedValue({
      upserted: ['row-1', 'row-2'],
      errors: [],
      zoomMeetingId: program.zoomMeetingId,
      topic: program.title,
    });
    prisma.program.findUnique.mockResolvedValue({ id: program.id });
    prisma.zoomRecordingFile.findMany.mockResolvedValue([recordingRow]);

    const result = await service.pull(program.id, { adminUserId: 'admin-1' });

    expect(pull.pullForProgram).toHaveBeenCalledWith(program.id, {
      adminUserId: 'admin-1',
    });
    expect(result.pulledCount).toBe(2);
    expect(result.recordings).toHaveLength(1);
  });

  it('propagates pull errors from ZoomRecordingsPullService', async () => {
    pull.pullForProgram.mockRejectedValue(new NotFoundException('nope'));
    await expect(service.pull(program.id, {})).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('returns a presigned download URL via storage service', async () => {
    prisma.zoomRecordingFile.findFirst.mockResolvedValue(recordingRow);
    const result = await service.createDownloadUrl(program.id, 'row-1');
    expect(result.url).toBe('https://s3.example/presigned');
    expect(result.expiresInSeconds).toBe(900);
    expect(result.recording.fileType).toBe('TRANSCRIPT');
    expect(storage.createPresignedDownloadUrl).toHaveBeenCalledWith(
      expect.objectContaining({
        bucket: recordingRow.s3Bucket,
        key: recordingRow.s3Key,
        disposition: undefined,
      }),
    );
  });

  it('passes inline disposition to storage service', async () => {
    prisma.zoomRecordingFile.findFirst.mockResolvedValue(recordingRow);
    await service.createDownloadUrl(program.id, 'row-1', {
      disposition: 'inline',
    });
    expect(storage.createPresignedDownloadUrl).toHaveBeenCalledWith(
      expect.objectContaining({ disposition: 'inline' }),
    );
  });

  it('rejects download when S3 key is missing', async () => {
    prisma.zoomRecordingFile.findFirst.mockResolvedValue({
      ...recordingRow,
      s3Bucket: null,
      s3Key: null,
    });
    await expect(
      service.createDownloadUrl(program.id, 'row-1'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
