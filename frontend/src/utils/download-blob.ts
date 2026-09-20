export function downloadBlob(blob: Blob, filename: string) {
  // Prefer an explicit UTF-8 CSV type so browsers/Excel get charset hints
  // when the server already sent a BOM-prefixed body.
  const typed =
    blob.type && blob.type !== 'application/octet-stream'
      ? blob
      : new Blob([blob], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(typed);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function slugifyFilenamePart(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

/** e.g. program-1-registration-responses.csv, program-1-post-event-responses.csv */
export function surveyResponsesDownloadFilename(
  programTitle: string,
  surveyType: string,
): string {
  const programSlug = slugifyFilenamePart(programTitle) || 'survey';
  const typeSlug =
    surveyType === 'INTAKE' || surveyType === 'intake'
      ? 'registration'
      : surveyType === 'FEEDBACK' || surveyType === 'feedback'
        ? 'post-event'
        : slugifyFilenamePart(surveyType) || 'survey';
  return `${programSlug}-${typeSlug}-responses.csv`;
}
