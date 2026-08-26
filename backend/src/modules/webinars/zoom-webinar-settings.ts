export interface ZoomWebinarSettings {
  /** Q&A in the webinar. */
  questionAndAnswer: boolean;
  /**
   * Zoom API field `practice_session`. Zoom's UI now labels this Backstage:
   * hosts and panelists can join before the webinar starts.
   */
  backstage: boolean;
  /** HD video for screen share (`hd_video`). */
  hdVideoScreenShare: boolean;
  /** Always send 1080p to attendees (`send_1080p_video_to_attendees`). */
  hdVideo1080p: boolean;
  /** Include guest emails in attendee reports. */
  emailInAttendeeReport: boolean;
  /** Automatic cloud recording (`auto_recording: cloud`). */
  autoRecordCloud: boolean;
}

/** Defaults for new webinars created in CHT (ticket SCRUM-182). */
export const DEFAULT_ZOOM_WEBINAR_SETTINGS: ZoomWebinarSettings = {
  questionAndAnswer: true,
  backstage: false,
  hdVideoScreenShare: true,
  hdVideo1080p: false,
  emailInAttendeeReport: false,
  autoRecordCloud: true,
};

export type ZoomWebinarSettingsApiPayload = {
  practice_session: boolean;
  hd_video: boolean;
  send_1080p_video_to_attendees: boolean;
  email_in_attendee_report: boolean;
  auto_recording: 'cloud' | 'none';
  question_and_answer: { enable: boolean };
};

export function toZoomWebinarSettingsApi(
  settings: ZoomWebinarSettings,
): ZoomWebinarSettingsApiPayload {
  return {
    practice_session: settings.backstage,
    hd_video: settings.hdVideoScreenShare,
    send_1080p_video_to_attendees: settings.hdVideo1080p,
    email_in_attendee_report: settings.emailInAttendeeReport,
    auto_recording: settings.autoRecordCloud ? 'cloud' : 'none',
    question_and_answer: { enable: settings.questionAndAnswer },
  };
}

/** Q&A / Backstage / attendee-report only — omit HD and recording (often locked on the Zoom account). */
export function omitAccountLockedWebinarSettings(
  settings: ZoomWebinarSettingsApiPayload,
): Pick<
  ZoomWebinarSettingsApiPayload,
  'practice_session' | 'email_in_attendee_report' | 'question_and_answer'
> {
  return {
    practice_session: settings.practice_session,
    email_in_attendee_report: settings.email_in_attendee_report,
    question_and_answer: settings.question_and_answer,
  };
}

function zoomErrorText(err: unknown): string {
  const parts: string[] = [];
  if (err instanceof Error) parts.push(err.message);
  if (err && typeof err === 'object' && 'response' in err) {
    const res = (err as { response?: { data?: unknown } }).response;
    if (res?.data) parts.push(JSON.stringify(res.data));
  }
  return parts.join(' ');
}

/** Zoom rejected HD / 1080p / cloud recording because the account locks or lacks the feature. */
export function isZoomAccountLockedSettingsError(err: unknown): boolean {
  const text = zoomErrorText(err);
  return (
    /locked (at|by) (the )?(account|group)/i.test(text) ||
    /settings?.is locked/i.test(text) ||
    /1080p/i.test(text) ||
    /hd_video|hd video/i.test(text) ||
    /auto_recording/i.test(text) ||
    /cloud recording/i.test(text) ||
    /cannot (enable|change|update|set).*(recording|1080|hd)/i.test(text) ||
    /recording.*(not (enabled|available|allowed)|locked)/i.test(text) ||
    /this (feature|setting) is (not available|not enabled|locked)/i.test(text)
  );
}

export function fromZoomWebinarSettingsApi(
  raw: {
    practice_session?: boolean;
    hd_video?: boolean;
    send_1080p_video_to_attendees?: boolean;
    email_in_attendee_report?: boolean;
    auto_recording?: string;
    question_and_answer?: { enable?: boolean };
  } | undefined,
): ZoomWebinarSettings {
  if (!raw) {
    return { ...DEFAULT_ZOOM_WEBINAR_SETTINGS };
  }
  return {
    questionAndAnswer: raw.question_and_answer?.enable ?? false,
    backstage: raw.practice_session ?? false,
    hdVideoScreenShare: raw.hd_video ?? false,
    hdVideo1080p: raw.send_1080p_video_to_attendees ?? false,
    emailInAttendeeReport: raw.email_in_attendee_report ?? false,
    autoRecordCloud: raw.auto_recording === 'cloud',
  };
}

function readBool(
  raw: Record<string, unknown>,
  key: keyof ZoomWebinarSettings,
  fallback: boolean,
): boolean {
  return typeof raw[key] === 'boolean' ? (raw[key] as boolean) : fallback;
}

/** Merge a JSON body with defaults. Unknown keys are ignored. */
export function parseZoomWebinarSettings(
  raw: unknown,
  fallback: ZoomWebinarSettings = DEFAULT_ZOOM_WEBINAR_SETTINGS,
): ZoomWebinarSettings {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ...fallback };
  }
  const o = raw as Record<string, unknown>;
  return {
    questionAndAnswer: readBool(o, 'questionAndAnswer', fallback.questionAndAnswer),
    backstage: readBool(o, 'backstage', fallback.backstage),
    hdVideoScreenShare: readBool(o, 'hdVideoScreenShare', fallback.hdVideoScreenShare),
    hdVideo1080p: readBool(o, 'hdVideo1080p', fallback.hdVideo1080p),
    emailInAttendeeReport: readBool(
      o,
      'emailInAttendeeReport',
      fallback.emailInAttendeeReport,
    ),
    autoRecordCloud: readBool(o, 'autoRecordCloud', fallback.autoRecordCloud),
  };
}
