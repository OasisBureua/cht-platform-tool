export type RecordingUrlDisposition = 'inline' | 'attachment';

export function extForFile(fileType: string, fileExtension?: string | null): string {
  if (fileExtension?.trim()) {
    const e = fileExtension.trim().replace(/^\./, '').toLowerCase();
    return e || 'bin';
  }
  const t = fileType.toUpperCase();
  if (t === 'MP4') return 'mp4';
  if (t === 'M4A') return 'm4a';
  if (t === 'TIMELINE') return 'json';
  if (t === 'TRANSCRIPT' || t === 'CC') return 'vtt';
  if (t === 'CHAT') return 'txt';
  if (t === 'CSV') return 'csv';
  return 'bin';
}

export function contentTypeFor(fileType: string, ext: string): string {
  const t = fileType.toUpperCase();
  if (t === 'MP4' || ext === 'mp4') return 'video/mp4';
  if (t === 'M4A' || ext === 'm4a') return 'audio/mp4';
  if (ext === 'vtt') return 'text/vtt';
  if (ext === 'txt') return 'text/plain';
  if (ext === 'json') return 'application/json';
  if (ext === 'csv') return 'text/csv';
  return 'application/octet-stream';
}

/** Content-Type that browsers will display in a tab instead of saving to disk. */
export function inlineContentType(fileType: string, ext: string): string {
  const t = fileType.toUpperCase();
  if (t === 'TRANSCRIPT' || t === 'CC' || t === 'CHAT') {
    return 'text/plain; charset=utf-8';
  }
  return contentTypeFor(fileType, ext);
}

export function storedContentType(
  fileType: string,
  ext: string,
  zoomContentType?: string | null,
): string {
  const zoomCt = zoomContentType?.split(';')[0]?.trim().toLowerCase() || '';
  if (!zoomCt || zoomCt === 'application/octet-stream') {
    return contentTypeFor(fileType, ext);
  }
  return zoomCt;
}

export function downloadFilename(row: {
  chmAssetFilename?: string | null;
  fileType: string;
  zoomRecordingFileId: string;
  fileExtension: string | null;
}): string {
  if (row.chmAssetFilename?.trim()) {
    return row.chmAssetFilename.trim();
  }
  const ext =
    (row.fileExtension || extForFile(row.fileType, row.fileExtension))
      .replace(/[^a-z0-9]/gi, '')
      .toLowerCase() || 'bin';
  const id = row.zoomRecordingFileId.replace(/[^a-zA-Z0-9._-]/g, '_');
  return `${row.fileType.toLowerCase()}-${id}.${ext}`;
}

export function buildRecordingS3Key(opts: {
  programId?: string | null;
  meetingId: string;
  fileId: string;
  ext: string;
}): string {
  const owner = zoomRecordingsOwnerKey(opts.programId);
  return `zoom-recordings/${owner}/${opts.meetingId}/${opts.fileId}.${opts.ext}`;
}

/** Program id or `unlinked` for catalog sessions not linked to a Program. */
export function zoomRecordingsOwnerKey(programId?: string | null): string {
  return programId?.trim() || 'unlinked';
}

export function shouldStreamFileType(
  fileType: string,
  streamTypes: string[] = ['MP4', 'M4A'],
): boolean {
  return streamTypes.includes(fileType.trim().toUpperCase());
}
