import {
  DEFAULT_ZOOM_WEBINAR_SETTINGS,
  fromZoomWebinarSettingsApi,
  isZoomAccountLockedSettingsError,
  omitAccountLockedWebinarSettings,
  parseZoomWebinarSettings,
  toZoomWebinarSettingsApi,
} from './zoom-webinar-settings';

describe('Zoom webinar settings mapping', () => {
  it('uses ticket defaults for new webinars', () => {
    expect(DEFAULT_ZOOM_WEBINAR_SETTINGS).toEqual({
      questionAndAnswer: true,
      backstage: false,
      hdVideoScreenShare: true,
      hdVideo1080p: false,
      emailInAttendeeReport: false,
      autoRecordCloud: true,
    });
  });

  it('maps Backstage to Zoom practice_session (API name is still practice_session)', () => {
    const api = toZoomWebinarSettingsApi({
      ...DEFAULT_ZOOM_WEBINAR_SETTINGS,
      backstage: true,
    });
    expect(api.practice_session).toBe(true);
    expect(api.question_and_answer).toEqual({ enable: true });
    expect(api.hd_video).toBe(true);
    expect(api.send_1080p_video_to_attendees).toBe(false);
    expect(api.email_in_attendee_report).toBe(false);
    expect(api.auto_recording).toBe('cloud');
  });

  it('reads Zoom GET payload including Q&A object and cloud recording', () => {
    expect(
      fromZoomWebinarSettingsApi({
        practice_session: true,
        hd_video: false,
        send_1080p_video_to_attendees: true,
        email_in_attendee_report: true,
        auto_recording: 'none',
        question_and_answer: { enable: false },
      }),
    ).toEqual({
      questionAndAnswer: false,
      backstage: true,
      hdVideoScreenShare: false,
      hdVideo1080p: true,
      emailInAttendeeReport: true,
      autoRecordCloud: false,
    });
  });

  it('parses a client body and ignores unknown keys', () => {
    expect(
      parseZoomWebinarSettings({
        questionAndAnswer: false,
        backstage: true,
        extra: 'nope',
      }),
    ).toEqual({
      ...DEFAULT_ZOOM_WEBINAR_SETTINGS,
      questionAndAnswer: false,
      backstage: true,
    });
  });

  it('omits HD and cloud recording from a locked-account retry payload', () => {
    const stripped = omitAccountLockedWebinarSettings(
      toZoomWebinarSettingsApi(DEFAULT_ZOOM_WEBINAR_SETTINGS),
    );
    expect(stripped).toEqual({
      practice_session: false,
      email_in_attendee_report: false,
      question_and_answer: { enable: true },
    });
    expect(stripped).not.toHaveProperty('auto_recording');
    expect(stripped).not.toHaveProperty('send_1080p_video_to_attendees');
    expect(stripped).not.toHaveProperty('hd_video');
  });

  it('detects Zoom account-locked HD/recording errors', () => {
    expect(
      isZoomAccountLockedSettingsError(
        new Error('This setting is locked at the account level'),
      ),
    ).toBe(true);
    expect(
      isZoomAccountLockedSettingsError(
        Object.assign(new Error('Request failed'), {
          response: {
            data: { message: 'Cannot enable 1080p video for this account' },
          },
        }),
      ),
    ).toBe(true);
    expect(
      isZoomAccountLockedSettingsError(new Error('Invalid start_time')),
    ).toBe(false);
  });
});
