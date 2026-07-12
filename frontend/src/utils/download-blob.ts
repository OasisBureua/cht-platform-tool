export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
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
