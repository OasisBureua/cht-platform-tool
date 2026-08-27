import {
  BadRequestException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import {
  contentTypeFor,
  extForFile,
  inlineContentType,
  ProgramZoomRecordingsService,
} from './program-zoom-recordings.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ZoomService } from '../webinars/zoom.service';

const mockS3Send = jest.fn();
const mockGetSignedUrl = jest.fn();

jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn().mockImplementation(() => ({ send: mockS3Send })),
  PutObjectCommand: jest.fn().mockImplementation((input: unknown) => ({ input })),
  GetObjectCommand: jest.fn().mockImplementation((input: unknown) => ({ input })),
}));

jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: (...args: unknown[]) => mockGetSignedUrl(...args),
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
    programZoomRecording: {
      findMany: jest.Mock;
      findFirst: jest.Mock;
      upsert: jest.Mock;
    };
  };
  let zoom: {
    isConfigured: jest.Mock;
    getMeetingRecordings: jest.Mock;
    downloadRecordingFile: jest.Mock;
  };
  let service: ProgramZoomRecordingsService;

  beforeEach(() => {
    mockS3Send.mockReset().mockResolvedValue({});
    mockGetSignedUrl.mockReset().mockResolvedValue('https://s3.example/presigned');
    prisma = {
      program: { findUnique: jest.fn() },
      programZoomRecording: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn(),
        upsert: jest.fn().mockResolvedValue({
          id: 'row-1',
          programId: program.id,
          zoomMeetingId: program.zoomMeetingId,
          zoomRecordingFileId: 'tr-1',
          fileType: 'TRANSCRIPT',
          recordingType: 'audio_transcript',
          fileExtension: 'vtt',
          fileSizeBytes: 678,
          s3Bucket: 'cht-platform-session-assets',
          s3Key: 'zoom-recordings/seed-program-1/83768449108/tr-1.vtt',
          recordingStart: new Date('2026-08-21T20:21:40Z'),
          recordingEnd: null,
          topic: program.title,
          pulledAt: new Date('2026-08-26T12:00:00Z'),
          pulledByUserId: 'admin-1',
        }),
      },
    };
    zoom = {
      isConfigured: jest.fn().mockReturnValue(true),
      getMeetingRecordings: jest.fn(),
      downloadRecordingFile: jest.fn(),
    };
    const config = {
      get: jest.fn((key: string) => {
        if (key === 'sessionAssets.s3Bucket' || key === 'zoomRecordings.s3Bucket') {
          return 'cht-platform-session-assets';
        }
        if (key === 'aws.region') return 'us-east-1';
        return undefined;
      }),
    };
    service = new ProgramZoomRecordingsService(
      prisma as unknown as PrismaService,
      config as unknown as ConfigService,
      zoom as unknown as ZoomService,
    );
  });

  it('lists stored rows for a program', async () => {
    prisma.program.findUnique.mockResolvedValue({ id: program.id });
    prisma.programZoomRecording.findMany.mockResolvedValue([
      {
        id: 'row-1',
        programId: program.id,
        zoomMeetingId: program.zoomMeetingId,
        zoomRecordingFileId: 'tr-1',
        fileType: 'TRANSCRIPT',
        recordingType: 'audio_transcript',
        fileExtension: 'vtt',
        fileSizeBytes: 678,
        s3Bucket: 'bucket',
        s3Key: 'key',
        recordingStart: null,
        recordingEnd: null,
        topic: program.title,
        pulledAt: new Date('2026-08-26T12:00:00Z'),
        pulledByUserId: null,
      },
    ]);

    const result = await service.list(program.id);
    expect(result.zoomConfigured).toBe(true);
    expect(result.storageConfigured).toBe(true);
    expect(result.recordings[0]?.fileType).toBe('TRANSCRIPT');
  });

  it('rejects pull when the program has no Zoom id', async () => {
    prisma.program.findUnique.mockResolvedValue({
      ...program,
      zoomMeetingId: null,
    });
    await expect(service.pull(program.id, {})).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(zoom.getMeetingRecordings).not.toHaveBeenCalled();
  });

  it('maps Zoom 404 to NotFoundException', async () => {
    prisma.program.findUnique.mockResolvedValue(program);
    zoom.getMeetingRecordings.mockRejectedValue({
      response: { status: 404, data: { message: 'Recording not found' } },
    });
    await expect(service.pull(program.id, {})).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('pulls TRANSCRIPT and MP4 files into S3 and upserts both', async () => {
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
    zoom.downloadRecordingFile.mockImplementation(async (url: string) => {
      if (url.endsWith('.vtt')) {
        return { buffer: Buffer.from('WEBVTT\n\nhello'), contentType: 'text/vtt' };
      }
      return { buffer: Buffer.from('mp4'), contentType: 'video/mp4' };
    });

    const result = await service.pull(program.id, { adminUserId: 'admin-1' });

    expect(zoom.getMeetingRecordings).toHaveBeenCalledWith('83768449108');
    expect(zoom.downloadRecordingFile).toHaveBeenCalledTimes(2);
    expect(mockS3Send).toHaveBeenCalledTimes(2);
    expect(prisma.programZoomRecording.upsert).toHaveBeenCalledTimes(2);
    expect(result.pulledCount).toBe(2);
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
      service.pull(program.id, { zoomMeetingId: '83768449108' }),
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

    await service.pull(program.id, { adminUserId: 'admin-1' });

    expect(PutObjectCommand).toHaveBeenCalledWith(
      expect.objectContaining({ ContentType: 'text/vtt' }),
    );
  });

  it('returns a presigned download URL', async () => {
    prisma.programZoomRecording.findFirst.mockResolvedValue({
      id: 'row-1',
      programId: program.id,
      s3Bucket: 'cht-platform-session-assets',
      s3Key: 'zoom-recordings/a/b/c.vtt',
      zoomMeetingId: program.zoomMeetingId,
      zoomRecordingFileId: 'tr-1',
      fileType: 'TRANSCRIPT',
      recordingType: 'audio_transcript',
      fileExtension: 'vtt',
      fileSizeBytes: 678,
      recordingStart: null,
      recordingEnd: null,
      topic: program.title,
      pulledAt: new Date(),
      pulledByUserId: null,
    });
    const result = await service.createDownloadUrl(program.id, 'row-1');
    expect(result.url).toBe('https://s3.example/presigned');
    expect(result.expiresInSeconds).toBe(900);
    expect(result.recording.fileType).toBe('TRANSCRIPT');
    expect(GetObjectCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        ResponseContentDisposition: 'attachment; filename="transcript-tr-1.vtt"',
        ResponseContentType: 'text/vtt',
      }),
    );
  });

  it('signs an inline URL so View opens in the browser', async () => {
    prisma.programZoomRecording.findFirst.mockResolvedValue({
      id: 'row-1',
      programId: program.id,
      s3Bucket: 'cht-platform-session-assets',
      s3Key: 'zoom-recordings/a/b/c.vtt',
      zoomMeetingId: program.zoomMeetingId,
      zoomRecordingFileId: 'tr-1',
      fileType: 'TRANSCRIPT',
      recordingType: 'audio_transcript',
      fileExtension: 'vtt',
      fileSizeBytes: 678,
      recordingStart: null,
      recordingEnd: null,
      topic: program.title,
      pulledAt: new Date(),
      pulledByUserId: null,
    });
    await service.createDownloadUrl(program.id, 'row-1', {
      disposition: 'inline',
    });
    expect(GetObjectCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        ResponseContentDisposition: 'inline',
        ResponseContentType: 'text/plain; charset=utf-8',
      }),
    );
  });

  it('throws when Zoom is not configured', async () => {
    zoom.isConfigured.mockReturnValue(false);
    await expect(service.pull(program.id, {})).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });
});
