function safeFilenamePart(value: string): string {
  return value
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 100);
}

/**
 * Opens the browser print dialog with a PDF-friendly report containing analytics
 * and the complete individual-response appendix. Browser "Save as PDF" preserves
 * SVG charts more reliably than screenshotting.
 */
export function printSurveyResponsesPdf(title: string): void {
  const previousTitle = document.title;
  const filename = safeFilenamePart(title) || 'survey-responses';
  document.title = `${filename}-survey-responses`;
  try {
    window.print();
  } finally {
    document.title = previousTitle;
  }
}
