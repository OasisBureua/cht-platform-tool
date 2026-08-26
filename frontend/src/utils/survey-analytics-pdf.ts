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

function formatPrintDate(): string {
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'long',
    timeStyle: 'short',
  }).format(new Date());
}

function buildAnalyticsPrintHtml(title: string, analyticsHtml: string, styles: string): string {
  const filename = safeFilenamePart(title) || 'survey-analytics';
  const generatedAt = formatPrintDate();
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(filename)}-analytics</title>
  ${styles}
  <style>
    @page { size: portrait; margin: 14mm 12mm; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 0;
      background: #fff;
      color: #111827;
      font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif;
      font-size: 10pt;
      line-height: 1.45;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .print-header {
      margin-bottom: 18px;
      padding-bottom: 12px;
      border-bottom: 1px solid #e5e7eb;
    }
    h1 { font-size: 17pt; font-weight: 700; margin: 0 0 4px; line-height: 1.25; }
    .subtitle { color: #4b5563; margin: 0; font-size: 9.5pt; }
    .generated-at { color: #6b7280; margin: 6px 0 0; font-size: 8.5pt; }
    a { color: inherit !important; text-decoration: none !important; }
    a[href]::after { content: none !important; }

    [data-testid="survey-analytics-view"] {
      display: block !important;
      width: 100% !important;
      max-width: none !important;
    }
    [data-testid="survey-analytics-view"] > * + * {
      margin-top: 14px;
    }

    /* Summary cards: three across on portrait letter */
    [data-testid="survey-analytics-view"] .grid {
      display: grid !important;
      gap: 10px !important;
    }
    [data-testid="survey-analytics-view"] .grid.sm\\:grid-cols-3,
    [data-testid="survey-analytics-view"] .grid-cols-1.sm\\:grid-cols-3 {
      grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
    }
    [data-testid="survey-analytics-view"] .grid.lg\\:grid-cols-2 {
      grid-template-columns: 1fr !important;
    }

    [data-testid="survey-analytics-view"] section,
    [data-testid="survey-analytics-view"] .rounded-2xl {
      break-inside: avoid;
      page-break-inside: avoid;
      border: 1px solid #e5e7eb !important;
      border-radius: 8px !important;
      background: #fff !important;
      padding: 12px !important;
      box-shadow: none !important;
    }

    [data-testid="survey-analytics-view"] h3 {
      font-size: 10.5pt !important;
      font-weight: 600 !important;
      color: #111827 !important;
      margin: 0 !important;
    }

    [data-testid="survey-analytics-view"] [data-testid="submissions-trend-chart"],
    [data-testid="survey-analytics-view"] [data-testid="choice-pie-chart"],
    [data-testid="survey-analytics-view"] [data-testid="choice-distribution-chart"],
    [data-testid="survey-analytics-view"] [data-testid="rating-histogram"] {
      width: 100% !important;
      max-width: 100% !important;
      height: 170px !important;
      min-height: 170px !important;
    }

    [data-testid="survey-analytics-view"] svg.recharts-surface {
      max-width: 100% !important;
    }

    [data-print-show] {
      display: block !important;
    }

    @media print {
      body { padding: 0; }
    }
  </style>
</head>
<body>
  <header class="print-header">
    <h1>${escapeHtml(title)}</h1>
    <p class="subtitle">Survey analytics report</p>
    <p class="generated-at">Generated ${escapeHtml(generatedAt)}</p>
  </header>
  ${analyticsHtml}
</body>
</html>`;
}

/**
 * Prints the live analytics visualizations (summary cards + charts) via a
 * same-document hidden iframe: no pop-up window, so browsers won't block it.
 */
export function printSurveyAnalyticsPdf(title: string): boolean {
  if (typeof window === 'undefined' || typeof document === 'undefined') return false;

  const view = document.querySelector<HTMLElement>('[data-testid="survey-analytics-view"]');
  if (!view) return false;

  const clone = view.cloneNode(true) as HTMLElement;
  clone.querySelectorAll('[data-print-hide], button, select, label, [role="group"]').forEach((el) => {
    el.remove();
  });
  clone.querySelectorAll('[data-print-show]').forEach((el) => {
    el.removeAttribute('hidden');
    if (el instanceof HTMLElement) {
      el.style.display = 'block';
    }
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
