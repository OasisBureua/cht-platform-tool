import {
  BadRequestException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { Readable } from 'stream';
import { PrismaService } from '../../prisma/prisma.service';
import { ZoomService } from '../webinars/zoom.service';
import { ChmContentIdService } from './chm-content-id.service';
import { ZoomRecordingsPullService } from './zoom-recordings-pull.service';
import { ZoomRecordingsSessionService } from './zoom-recordings-session.service';
import { ZoomRecordingsStorageService } from './zoom-recordings-storage.service';

const mockS3Send = jest.fn();
const mockUploadDone = jest.fn();

jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn().mockImplementation(() => ({ send: mockS3Send })),
  PutObjectCommand: jest.fn().mockImplementation((input: unknown) => ({ input })),
  GetObjectCommand: jest.fn(),
}));

jest.mock('@aws-sdk/lib-storage', () => ({
  Upload: jest.fn().mockImplementation(() => ({
    on: jest.fn(),
    done: (...args: unknown[]) => mockUploadDone(...args),
  })),
}));

describe('ZoomRecordingsPullService', () => {
  const program = {
    id: 'seed-program-1',
    title: 'Webinar Test',
    zoomMeetingId: '83768449108',
    zoomSessionType: 'WEBINAR' as const,
    chmProgramId: null as string | null,
  };

  let prisma: {
    program: { findUnique: jest.Mock };
    zoomRecordingSession: { upsert: jest.Mock };
    zoomRecordingFile: {
      upsert: jest.Mock;
      updateMany: jest.Mock;
    };
  };
  let zoom: {
    isConfigured: jest.Mock;
    getMeetingRecordings: jest.Mock;
    downloadRecordingFile: jest.Mock;
    downloadRecordingFileStream: jest.Mock;
  };
  let chmContentId: { zoomFileTypeToAssetFormat: jest.Mock };
  let service: ZoomRecordingsPullService;

  beforeEach(() => {
    mockS3Send.mockReset().mockResolvedValue({});
    mockUploadDone.mockReset().mockResolvedValue({});
    prisma = {
      program: { findUnique: jest.fn() },
      zoomRecordingSession: {
        upsert: jest.fn().mockResolvedValue({
          id: 'session-1',
          zoomMeetingId: program.zoomMeetingId,
          programId: program.id,
          chmProgramId: null,
        }),
      },
      zoomRecordingFile: {
        upsert: jest.fn().mockImplementation(({ create }) =>
          Promise.resolve({
            id: `row-${create.zoomRecordingFileId}`,
            ...create,
          }),
        ),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
    };
    zoom = {
      isConfigured: jest.fn().mockReturnValue(true),
      getMeetingRecordings: jest.fn(),
      downloadRecordingFile: jest.fn(),
      downloadRecordingFileStream: jest.fn(),
    };
    chmContentId = {
      zoomFileTypeToAssetFormat: jest.fn((fileType: string) => {
        const t = fileType.toUpperCase();
        if (t === 'TRANSCRIPT') return 'TRANSCRIPT';
        if (t === 'MP4') return 'MP4';
        return 'MP4';
      }),
    };
    const config = {
      get: jest.fn((key: string) => {
        if (key === 'sessionAssets.s3Bucket' || key === 'zoomRecordings.s3Bucket') {
          return 'cht-platform-session-assets';
        }
        if (key === 'zoomRecordings.streamFileTypes') return ['MP4', 'M4A'];
        if (key === 'aws.region') return 'us-east-1';
        return undefined;
      }),
    };
    const sessions = new ZoomRecordingsSessionService(
      prisma as unknown as PrismaService,
    );
    const storage = new ZoomRecordingsStorageService(
      config as unknown as ConfigService,
    );
    service = new ZoomRecordingsPullService(
      prisma as unknown as PrismaService,
      config as unknown as ConfigService,
      zoom as unknown as ZoomService,
      chmContentId as unknown as ChmContentIdService,
      sessions,
      storage,
    );
  });

  it('rejects pull when the program has no Zoom id', async () => {
    prisma.program.findUnique.mockResolvedValue({
      ...program,
      zoomMeetingId: null,
    });
    await expect(service.pullForProgram(program.id, {})).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(zoom.getMeetingRecordings).not.toHaveBeenCalled();
  });

  it('maps Zoom 404 to NotFoundException', async () => {
    prisma.program.findUnique.mockResolvedValue(program);
    zoom.getMeetingRecordings.mockRejectedValue({
      response: { status: 404, data: { message: 'Recording not found' } },
    });
    await expect(service.pullForProgram(program.id, {})).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('pulls TRANSCRIPT via buffer and MP4 via stream upload', async () => {
    prisma.program.findUnique.mockResolvedValue(program);
    zoom.getMeetingRecordings.mockResolvedValue({
      topic: 'Webinar Test',
      downloadAccessToken: 'dl-token',
      recordingFiles: [
        {
          id: 'mp4-1',
          fileType: 'MP4',
          fileExtension: 'MP4',
          downloadUrl: 'https://zoom.example/video.mp4',
          status: 'completed',
          recordingType: 'active_speaker',
          fileSize: 1000,
        },
        {
          id: 'tr-1',
          fileType: 'TRANSCRIPT',
          fileExtension: 'VTT',
          downloadUrl: 'https://zoom.example/audio.vtt',
          status: 'completed',
          recordingType: 'audio_transcript',
          fileSize: 678,
        },
      ],
    });
    zoom.downloadRecordingFileStream.mockResolvedValue({
      stream: Readable.from([Buffer.from('mp4')]),
      contentType: 'video/mp4',
    });
    zoom.downloadRecordingFile.mockResolvedValue({
      buffer: Buffer.from('WEBVTT\n\nhello'),
      contentType: 'text/vtt',
    });

    const result = await service.pullForProgram(program.id, {
      adminUserId: 'admin-1',
    });

    expect(zoom.getMeetingRecordings).toHaveBeenCalledWith('83768449108');
    expect(zoom.downloadRecordingFileStream).toHaveBeenCalledTimes(1);
    expect(zoom.downloadRecordingFile).toHaveBeenCalledTimes(1);
    expect(mockUploadDone).toHaveBeenCalledTimes(1);
    expect(mockS3Send).toHaveBeenCalledTimes(1);
    expect(prisma.zoomRecordingSession.upsert).toHaveBeenCalledTimes(1);
    expect(prisma.zoomRecordingFile.upsert).toHaveBeenCalledTimes(2);
    expect(result.upserted).toHaveLength(2);
  });

  it('uses body zoomMeetingId override instead of the program id', async () => {
    prisma.program.findUnique.mockResolvedValue({
      ...program,
      zoomMeetingId: '111',
    });
    zoom.getMeetingRecordings.mockRejectedValue({
      response: { status: 404, data: { message: 'nope' } },
    });
    await expect(
      service.pullForProgram(program.id, { zoomMeetingId: '83768449108' }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(zoom.getMeetingRecordings).toHaveBeenCalledWith('83768449108');
  });

  it('stores mapped content type when Zoom sends octet-stream', async () => {
    prisma.program.findUnique.mockResolvedValue(program);
    zoom.getMeetingRecordings.mockResolvedValue({
      topic: 'Webinar Test',
      downloadAccessToken: 'dl-token',
      recordingFiles: [
        {
          id: 'tr-1',
          fileType: 'TRANSCRIPT',
          fileExtension: 'VTT',
          downloadUrl: 'https://zoom.example/audio.vtt',
          status: 'completed',
          recordingType: 'audio_transcript',
          fileSize: 678,
        },
      ],
    });
    zoom.downloadRecordingFile.mockResolvedValue({
      buffer: Buffer.from('WEBVTT\n\nhello'),
      contentType: 'application/octet-stream',
    });

    await service.pullForProgram(program.id, { adminUserId: 'admin-1' });

    expect(PutObjectCommand).toHaveBeenCalledWith(
      expect.objectContaining({ ContentType: 'text/vtt' }),
    );
  });

  it('throws when Zoom is not configured', async () => {
    zoom.isConfigured.mockReturnValue(false);
    await expect(service.pullForProgram(program.id, {})).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it('pullForSession stores Zoom-only files under unlinked S3 prefix', async () => {
    prisma.zoomRecordingSession = {
      findUnique: jest.fn().mockResolvedValue({
        id: 'session-unlinked',
        zoomMeetingId: '999888777',
        programId: null,
        chmProgramId: null,
        topic: 'Zoom-only webinar',
      }),
    } as unknown as typeof prisma.zoomRecordingSession;

    zoom.getMeetingRecordings.mockResolvedValue({
      topic: 'Zoom-only webinar',
      downloadAccessToken: 'tok',
      recordingFiles: [
        {
          id: 'tr-1',
          fileType: 'TRANSCRIPT',
          fileExtension: 'VTT',
          downloadUrl: 'https://zoom.example/t.vtt',
          status: 'completed',
          recordingType: 'audio_transcript',
          fileSize: 100,
        },
      ],
    });
    zoom.downloadRecordingFile.mockResolvedValue({
      buffer: Buffer.from('WEBVTT'),
      contentType: 'text/vtt',
    });

    const result = await service.pullForSession('session-unlinked', {
      adminUserId: 'admin-1',
    });

    expect(result.upserted).toHaveLength(1);
    expect(PutObjectCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        Key: 'zoom-recordings/unlinked/999888777/tr-1.vtt',
      }),
    );
  });
});
