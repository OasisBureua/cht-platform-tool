import { ZoomEmbed } from './ZoomEmbed';
import { webinarsApi } from '../../api/webinars';

/**
 * Zoom Meeting SDK embed for Office Hours (MEETING session type).
 * Thin wrapper around {@link ZoomEmbed} with the office-hours auth endpoint.
 */
export function OfficeHoursZoomEmbed({
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
      leaveLabel="Leave meeting"
      fetchAuth={() => webinarsApi.getMeetingSdkAuth(programId)}
      reportAttendance={(event) => webinarsApi.reportOfficeHoursSdkAttendance(programId, event)}
    />
  );
}
