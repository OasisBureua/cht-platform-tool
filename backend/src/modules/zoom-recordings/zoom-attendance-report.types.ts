/** One row in the exported S3 attendee report (CSV). */
export type AttendanceReportRow = {
  zoomParticipantId: string;
  participantName: string | null;
  participantEmail: string | null;
  joinTime: string | null;
  leaveTime: string | null;
  durationSeconds: number | null;
  isHost: boolean;
  source: string;
  importJobId: string | null;
  exportedAt: string;
};

export type AttendanceReportExportMeta = {
  s3Key: string;
  participantCount: number;
  exportedAt: Date;
};
