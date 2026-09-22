import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { of, throwError } from 'rxjs';
import {
  ZoomService,
  type ZoomAccountRecordingsPage,
} from './zoom.service';

describe('ZoomService account recordings', () => {
  const accountId = 'acct_test_123';

  function makeService(
    getImpl: jest.Mock,
    postImpl?: jest.Mock,
  ): ZoomService {
    const http = {
      get: getImpl,
      post:
        postImpl ??
        jest.fn().mockReturnValue(
          of({
            data: {
              access_token: 'zoom-token',
              expires_in: 3600,
              token_type: 'bearer',
            },
          }),
        ),
    } as unknown as HttpService;

    const config = {
      get: jest.fn((key: string) => {
        if (key === 'zoom.accountId') return accountId;
        if (key === 'zoom.clientId') return 'client-id';
        if (key === 'zoom.clientSecret') return 'client-secret';
        return undefined;
      }),
    } as unknown as ConfigService;

    return new ZoomService(config, http);
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('listAccountRecordingsPage calls account recordings API', async () => {
    const page: ZoomAccountRecordingsPage = {
      from: '2026-07-01',
      to: '2026-07-31',
      nextPageToken: 'page-2',
      totalRecords: 2,
      sessions: [
        {
          id: '83768449108',
          uuid: 'uuid-1',
          topic: 'Test Webinar',
          startTime: '2026-07-15T18:00:00Z',
          duration: 60,
          recordingFiles: [
            {
              id: 'file-1',
              fileType: 'TRANSCRIPT',
              downloadUrl: 'https://zoom.example/t.vtt',
              status: 'completed',
            },
          ],
        },
      ],
    };

    const get = jest.fn().mockReturnValue(
      of({
        data: {
          from: page.from,
          to: page.to,
          next_page_token: page.nextPageToken,
          total_records: page.totalRecords,
          meetings: [
            {
              id: 83768449108,
              uuid: 'uuid-1',
              topic: 'Test Webinar',
              start_time: '2026-07-15T18:00:00Z',
              duration: 60,
              recording_files: [
                {
                  id: 'file-1',
                  file_type: 'TRANSCRIPT',
                  download_url: 'https://zoom.example/t.vtt',
                  status: 'completed',
                },
              ],
            },
          ],
        },
      }),
    );

    const svc = makeService(get);
    const result = await svc.listAccountRecordingsPage({
      from: '2026-07-01',
      to: '2026-07-31',
    });

    expect(result.sessions).toHaveLength(1);
    expect(result.sessions[0]?.id).toBe('83768449108');
    expect(result.nextPageToken).toBe('page-2');
    expect(get).toHaveBeenCalledWith(
      `https://api.zoom.us/v2/accounts/${encodeURIComponent(accountId)}/recordings`,
      expect.objectContaining({
        params: { from: '2026-07-01', to: '2026-07-31', page_size: 300 },
        headers: { Authorization: 'Bearer zoom-token' },
      }),
    );
  });

  it('listAccountRecordingsInRange paginates until next_page_token is empty', async () => {
    const get = jest
      .fn()
      .mockReturnValueOnce(
        of({
          data: {
            meetings: [{ id: 1, recording_files: [] }],
            next_page_token: 'tok-2',
          },
        }),
      )
      .mockReturnValueOnce(
        of({
          data: {
            meetings: [{ id: 2, recording_files: [] }],
            next_page_token: '',
          },
        }),
      );

    const svc = makeService(get);
    const sessions = await svc.listAccountRecordingsInRange({
      from: '2026-08-01',
      to: '2026-08-31',
    });

    expect(sessions).toHaveLength(2);
    expect(get).toHaveBeenCalledTimes(2);
    expect(get.mock.calls[1][1].params.next_page_token).toBe('tok-2');
  });

  it('listUserRecordingsPage calls per-user recordings API', async () => {
    const get = jest.fn().mockReturnValue(
      of({
        data: {
          from: '2026-07-01',
          to: '2026-07-31',
          next_page_token: 'page-2',
          total_records: 1,
          meetings: [
            {
              id: 83768449108,
              uuid: 'uuid-1',
              topic: 'Test Webinar',
              host_email: 'host@example.com',
              start_time: '2026-07-15T18:00:00Z',
              duration: 60,
              recording_files: [
                {
                  id: 'file-1',
                  file_type: 'TRANSCRIPT',
                  download_url: 'https://zoom.example/t.vtt',
                  status: 'completed',
                },
              ],
            },
          ],
        },
      }),
    );

    const svc = makeService(get);
    const result = await svc.listUserRecordingsPage({
      userId: 'host-user-1',
      from: '2026-07-01',
      to: '2026-07-31',
    });

    expect(result.sessions).toHaveLength(1);
    expect(result.sessions[0]?.id).toBe('83768449108');
    expect(result.sessions[0]?.hostEmail).toBe('host@example.com');
    expect(get).toHaveBeenCalledWith(
      'https://api.zoom.us/v2/users/host-user-1/recordings',
      expect.objectContaining({
        params: { from: '2026-07-01', to: '2026-07-31', page_size: 300 },
        headers: { Authorization: 'Bearer zoom-token' },
      }),
    );
  });

  it('listUserRecordingsInRange paginates until next_page_token is empty', async () => {
    const get = jest
      .fn()
      .mockReturnValueOnce(
        of({
          data: {
            meetings: [{ id: 1, recording_files: [] }],
            next_page_token: 'tok-2',
          },
        }),
      )
      .mockReturnValueOnce(
        of({
          data: {
            meetings: [{ id: 2, recording_files: [] }],
            next_page_token: '',
          },
        }),
      );

    const svc = makeService(get);
    const sessions = await svc.listUserRecordingsInRange({
      userId: 'host-user-1',
      from: '2026-08-01',
      to: '2026-08-31',
    });

    expect(sessions).toHaveLength(2);
    expect(get).toHaveBeenCalledTimes(2);
    expect(get.mock.calls[1][1].params.next_page_token).toBe('tok-2');
  });

  it('listAllAccountUsers paginates GET /users', async () => {
    const get = jest
      .fn()
      .mockReturnValueOnce(
        of({
          data: {
            users: [{ id: 'u1', email: 'one@chm.example', status: 'active' }],
            next_page_token: 'n2',
          },
        }),
      )
      .mockReturnValueOnce(
        of({
          data: {
            users: [{ id: 'u2', email: 'two@chm.example', status: 'active' }],
            next_page_token: '',
          },
        }),
      );

    const svc = makeService(get);
    const users = await svc.listAllAccountUsers({ status: 'active' });

    expect(users.map((u) => u.id)).toEqual(['u1', 'u2']);
    expect(get).toHaveBeenCalledWith(
      'https://api.zoom.us/v2/users',
      expect.objectContaining({
        params: expect.objectContaining({
          status: 'active',
          page_size: 300,
        }),
      }),
    );
    expect(get.mock.calls[1][1].params.next_page_token).toBe('n2');
  });

  it('listAllAccountUsers skips blank ids and dedupes overlapping pages', async () => {
    const get = jest
      .fn()
      .mockReturnValueOnce(
        of({
          data: {
            users: [
              { id: '', email: 'blank@chm.example' },
              { id: 'u1', email: 'one@chm.example' },
            ],
            next_page_token: 'n2',
          },
        }),
      )
      .mockReturnValueOnce(
        of({
          data: {
            users: [
              { id: 'u1', email: 'one@chm.example' },
              { id: 'u2', email: 'two@chm.example' },
            ],
            next_page_token: '',
          },
        }),
      );

    const svc = makeService(get);
    const users = await svc.listAllAccountUsers({ status: 'active' });

    expect(users.map((u) => u.id)).toEqual(['u1', 'u2']);
  });

  it('listUserRecordingsPage encodes user id in the path', async () => {
    const get = jest.fn().mockReturnValue(
      of({ data: { meetings: [], next_page_token: '' } }),
    );
    const svc = makeService(get);
    await svc.listUserRecordingsPage({
      userId: 'host@example.com',
      from: '2026-08-01',
      to: '2026-08-31',
    });
    expect(get).toHaveBeenCalledWith(
      'https://api.zoom.us/v2/users/host%40example.com/recordings',
      expect.any(Object),
    );
  });

  it('listUserRecordingsPage rejects a blank user id', async () => {
    const svc = makeService(jest.fn());
    await expect(
      svc.listUserRecordingsPage({
        userId: '  ',
        from: '2026-08-01',
        to: '2026-08-31',
      }),
    ).rejects.toThrow('Zoom user id is required');
  });

  it('retries listUserRecordingsPage on HTTP 429', async () => {
    jest.useFakeTimers();
    const err429 = {
      message: 'Rate limited',
      response: { status: 429, headers: { 'retry-after': '1' } },
    };
    const get = jest
      .fn()
      .mockReturnValueOnce(throwError(() => err429))
      .mockReturnValueOnce(
        of({ data: { meetings: [{ id: 9, recording_files: [] }] } }),
      );
    const svc = makeService(get);

    const resultPromise = svc.listUserRecordingsPage({
      userId: 'host-1',
      from: '2026-08-01',
      to: '2026-08-31',
    });
    await jest.advanceTimersByTimeAsync(1000);
    const result = await resultPromise;

    expect(result.sessions).toHaveLength(1);
    expect(get).toHaveBeenCalledTimes(2);
    jest.useRealTimers();
  });

  it('downloadRecordingFileStream uses responseType stream', async () => {
    const fakeStream = { pipe: jest.fn() };
    const get = jest.fn().mockReturnValue(
      of({
        data: fakeStream,
        headers: { 'content-type': 'video/mp4' },
      }),
    );

    const svc = makeService(get);
    const result = await svc.downloadRecordingFileStream(
      'https://zoom.example/video.mp4',
      'dl-token',
    );

    expect(result.stream).toBe(fakeStream);
    expect(result.contentType).toBe('video/mp4');
    expect(get).toHaveBeenCalledWith(
      'https://zoom.example/video.mp4',
      expect.objectContaining({
        responseType: 'stream',
        headers: { Authorization: 'Bearer dl-token' },
      }),
    );
  });
});
