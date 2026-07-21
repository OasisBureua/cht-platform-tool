function safeFilenamePart(value: string): string {
  return value
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 100);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Opens a dedicated print window with the live analytics visualizations
 * (summary cards + charts). Does not include individual response rows.
 */
export function printSurveyAnalyticsPdf(title: string): boolean {
  if (typeof window === 'undefined' || typeof document === 'undefined') return false;

  const view = document.querySelector<HTMLElement>('[data-testid="survey-analytics-view"]');
  if (!view) return false;

  const clone = view.cloneNode(true) as HTMLElement;
  // Drop interactive chrome; keep the rendered chart SVGs/HTML.
  clone.querySelectorAll('[data-print-hide], button, select, label').forEach((el) => {
    el.remove();
  });

  const styles = Array.from(
    document.querySelectorAll('link[rel="stylesheet"], style'),
  )
    .map((node) => node.outerHTML)
    .join('\n');

  const filename = safeFilenamePart(title) || 'survey-analytics';
  const win = window.open('', '_blank', 'noopener,noreferrer,width=1200,height=900');
  if (!win) return false;

  win.document.open();
  win.document.write(`<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(filename)}-analytics</title>
  ${styles}
  <style>
    @page { size: landscape; margin: 12mm; }
    body {
      margin: 0;
      padding: 24px;
      background: #fff;
      color: #111827;
      font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif;
    }
    h1 { font-size: 22px; margin: 0 0 4px; }
    .subtitle { color: #4b5563; margin: 0 0 18px; font-size: 13px; }
    a { color: inherit !important; text-decoration: none !important; }
    a[href]::after { content: none !important; }
    [data-testid="survey-analytics-view"] > * {
      break-inside: avoid;
      page-break-inside: avoid;
    }
    @media print {
      body { padding: 0; }
    }
  </style>
</head>
<body>
  <h1>${escapeHtml(title)}</h1>
  <p class="subtitle">Survey analytics</p>
  ${clone.outerHTML}
</body>
</html>`);
  win.document.close();

  win.focus();
  win.setTimeout(() => {
    win.print();
    win.close();
  }, 300);

  return true;
}

/** @deprecated Prefer printSurveyAnalyticsPdf — kept for older call sites. */
export function printSurveyResponsesPdf(titleOrInput: string | { title: string }): boolean {
  const title = typeof titleOrInput === 'string' ? titleOrInput : titleOrInput.title;
  return printSurveyAnalyticsPdf(title);
}
