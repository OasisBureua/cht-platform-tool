import { ZoomEmbed } from './ZoomEmbed';
import { webinarsApi } from '../../api/webinars';

/**
 * Zoom Meeting SDK embed for Live Webinars (WEBINAR session type).
 * Attendees join as view-only (role 0); mic/camera follow Zoom webinar rules.
 */
export function WebinarZoomEmbed({
  programId,
  disabled,
  joinUrlFallback,
}: {
  programId: string;
  disabled?: boolean;
  joinUrlFallback?: string;
}) {
  return (
    <ZoomEmbed
      disabled={disabled}
      joinUrlFallback={joinUrlFallback}
      joinLabel="Join in browser"
      leaveLabel="Leave webinar"
      hint="Watch the live webinar inside CHT. Attendees join muted without video (Zoom webinar rules). Use Open in Zoom if your browser is unsupported."
      fetchAuth={() => webinarsApi.getWebinarMeetingSdkAuth(programId)}
      reportAttendance={(event) => webinarsApi.reportWebinarSdkAttendance(programId, event)}
    />
  );
}
