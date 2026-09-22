import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { of } from 'rxjs';
import { ZoomService } from './zoom.service';

describe('ZoomService report participants', () => {
  function makeService(getImpl: jest.Mock): ZoomService {
    const http = {
      get: getImpl,
      post: jest.fn().mockReturnValue(
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
        if (key === 'zoom.accountId') return 'acct_test';
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

  it('listWebinarReportParticipantsPage calls report API', async () => {
    const get = jest.fn().mockReturnValue(
      of({
        data: {
          total_records: 1,
          next_page_token: '',
          participants: [
            {
              id: 'pid-1',
              name: 'Dr. Example',
              user_email: 'hcp@example.com',
              join_time: '2026-08-01T18:00:00Z',
              leave_time: '2026-08-01T19:00:00Z',
              duration: 3600,
            },
          ],
        },
      }),
    );

    const svc = makeService(get);
    const page = await svc.listWebinarReportParticipantsPage({
      webinarId: '83768449108',
    });

    expect(page.participants).toHaveLength(1);
    expect(page.participants[0]?.userEmail).toBe('hcp@example.com');
    expect(get).toHaveBeenCalledWith(
      'https://api.zoom.us/v2/report/webinars/83768449108/participants',
      expect.objectContaining({
        params: { page_size: 300 },
        headers: { Authorization: 'Bearer zoom-token' },
      }),
    );
  });

  it('listReportParticipantsForSession paginates and retries uuid on 404', async () => {
    const get = jest
      .fn()
      .mockImplementationOnce(() => {
        throw { response: { status: 404 }, message: 'Not found' };
      })
      .mockReturnValueOnce(
        of({
          data: {
            participants: [{ id: 'p2', user_email: 'a@test.com' }],
            next_page_token: 'tok-2',
          },
        }),
      )
      .mockReturnValueOnce(
        of({
          data: {
            participants: [{ id: 'p3', user_email: 'b@test.com' }],
            next_page_token: '',
          },
        }),
      );

    const svc = makeService(get);
    const rows = await svc.listReportParticipantsForSession({
      sessionType: 'WEBINAR',
      meetingId: '123',
      zoomUuid: 'uuid/with/slash',
    });

    expect(rows).toHaveLength(2);
    expect(get).toHaveBeenCalledTimes(3);
  });
});
