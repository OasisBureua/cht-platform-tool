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

function buildAnalyticsPrintHtml(title: string, analyticsHtml: string, styles: string): string {
  const filename = safeFilenamePart(title) || 'survey-analytics';
  return `<!doctype html>
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
  ${analyticsHtml}
</body>
</html>`;
}

/**
 * Prints the live analytics visualizations (summary cards + charts) via a
 * same-document hidden iframe — no pop-up window, so browsers won't block it.
 */
export function printSurveyAnalyticsPdf(title: string): boolean {
  if (typeof window === 'undefined' || typeof document === 'undefined') return false;

  const view = document.querySelector<HTMLElement>('[data-testid="survey-analytics-view"]');
  if (!view) return false;

  const clone = view.cloneNode(true) as HTMLElement;
  clone.querySelectorAll('[data-print-hide], button, select, label').forEach((el) => {
    el.remove();
  });

  const styles = Array.from(
    document.querySelectorAll('link[rel="stylesheet"], style'),
  )
    .map((node) => node.outerHTML)
    .join('\n');

  const html = buildAnalyticsPrintHtml(title, clone.outerHTML, styles);
  const previousTitle = document.title;
  const filename = safeFilenamePart(title) || 'survey-analytics';
  document.title = `${filename}-analytics`;

  const iframe = document.createElement('iframe');
  iframe.setAttribute('aria-hidden', 'true');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  iframe.style.opacity = '0';
  iframe.style.pointerEvents = 'none';
  document.body.appendChild(iframe);

  const frameWindow = iframe.contentWindow;
  const frameDocument = frameWindow?.document;
  if (!frameWindow || !frameDocument) {
    iframe.remove();
    document.title = previousTitle;
    return false;
  }

  frameDocument.open();
  frameDocument.write(html);
  frameDocument.close();

  const cleanup = () => {
    document.title = previousTitle;
    iframe.remove();
  };

  // Let layout/styles settle, then print from the iframe (same user gesture chain).
  window.setTimeout(() => {
    try {
      frameWindow.focus();
      frameWindow.print();
    } finally {
      // Delay removal so the print dialog can snapshot the iframe contents.
      window.setTimeout(cleanup, 1000);
    }
  }, 250);

  return true;
}

/** @deprecated Prefer printSurveyAnalyticsPdf */
export function printSurveyResponsesPdf(titleOrInput: string | { title: string }): boolean {
  const title = typeof titleOrInput === 'string' ? titleOrInput : titleOrInput.title;
  return printSurveyAnalyticsPdf(title);
}
