import type { ProgramZoomRecordingRow, ZoomRecordingCatalogSession } from '../../../api/admin';

/**
 * What the clipper works on. A Zoom recording plays from its signed link
 * and exports a cut list; a file from the computer can also render clips.
 */
export type Source =
  | { kind: 'zoom'; key: string; title: string; fileName: string; url: string; session: ZoomRecordingCatalogSession; files: ProgramZoomRecordingRow[] }
  | { kind: 'local'; key: string; title: string; fileName: string; url: string; file: File };

/** The recording to clip: the largest MP4 in S3, which is Zoom's main view. */
export function pickVideo(files: ProgramZoomRecordingRow[]): ProgramZoomRecordingRow | undefined {
  return files
    .filter((f) => f.storedInS3 && /mp4/i.test(`${f.fileType} ${f.fileExtension ?? ''}`))
    .sort((a, b) => (b.fileSizeBytes ?? 0) - (a.fileSizeBytes ?? 0))[0];
}

export function pickTranscript(files: ProgramZoomRecordingRow[]): ProgramZoomRecordingRow | undefined {
  const inS3 = files.filter((f) => f.storedInS3);
  return inS3.find((f) => /transcript/i.test(f.fileType)) ?? inS3.find((f) => /^cc$/i.test(f.fileType) || /vtt/i.test(f.fileExtension ?? ''));
}

export const isVideoFile = (f: File) => f.type.startsWith('video/') || /\.(mp4|mov|m4v|webm|mkv)$/i.test(f.name);
export const isCaptionFile = (f: File) => /\.(vtt|srt)$/i.test(f.name) || f.type === 'text/vtt';
