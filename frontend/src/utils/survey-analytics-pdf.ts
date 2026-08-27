import {
  choicePieHeightPx,
  ratingHistogramHeightPx,
  submissionsTrendHeightPx,
} from '../components/admin/survey-analytics/chartSizing';

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

/** Row height used by ChoiceDistributionChart (keeps print bars from crushing). */
const BAR_ROW_PX = 44;
const BAR_MIN_PX = 120;

/**
 * Ensure chart containers keep usable heights in the print clone.
 * Horizontal bar charts must scale with option count — a fixed 170px height
 * was crushing Recharts labels into the HTML legend (overlap in PDF).
 * Pie / trend / rating scale down when data is sparse (Step 5).
 */
export function prepareAnalyticsPrintClone(clone: HTMLElement): void {
  clone.querySelectorAll<HTMLElement>('[data-print-only]').forEach((el) => {
    el.removeAttribute('hidden');
    el.style.display = 'block';
  });

  clone
    .querySelectorAll<HTMLElement>('[data-testid="choice-distribution-chart"]')
    .forEach((el) => {
      const fromAttr = Number(el.getAttribute('data-option-count') || '');
      const legendCount = el.parentElement?.querySelectorAll(':scope > ul > li').length ?? 0;
      const rows =
        (Number.isFinite(fromAttr) && fromAttr > 0 ? fromAttr : 0) ||
        legendCount ||
        3;
      const height = Math.max(BAR_MIN_PX, rows * BAR_ROW_PX);
      el.style.height = `${height}px`;
      el.style.minHeight = `${height}px`;
      el.style.maxHeight = 'none';
    });

  clone
    .querySelectorAll<HTMLElement>('[data-testid="choice-pie-chart"]')
    .forEach((el) => {
      const fromAttr = Number(el.getAttribute('data-nonzero-slices') || '');
      const nonZero =
        Number.isFinite(fromAttr) && fromAttr > 0
          ? fromAttr
          : // Fallback: count colored legend dots when attr missing
            el.parentElement?.querySelectorAll(':scope > ul > li').length || 3;
      const svg = el.querySelector('svg');
      const svgHeight = Number(svg?.getAttribute('height') || '');
      const height = Math.max(
        choicePieHeightPx(nonZero),
        Number.isFinite(svgHeight) && svgHeight > 0 ? svgHeight : 0,
      );
      el.style.height = `${height}px`;
      el.style.minHeight = `${height}px`;
      el.style.maxHeight = 'none';
      el.style.overflow = 'visible';
      // Recharts clipPath + print scaling clips the donut into a C-shape.
      el.querySelectorAll('clipPath').forEach((node) => node.remove());
      el.querySelectorAll<HTMLElement | SVGElement>('.recharts-wrapper, svg').forEach((node) => {
        node.style.overflow = 'visible';
      });
    });

  clone
    .querySelectorAll<HTMLElement>('[data-testid="submissions-trend-chart"]')
    .forEach((el) => {
      const fromAttr = Number(el.getAttribute('data-point-count') || '');
      const points = Number.isFinite(fromAttr) && fromAttr > 0 ? fromAttr : 7;
      const height = submissionsTrendHeightPx(points);
      el.style.height = `${height}px`;
      el.style.minHeight = `${height}px`;
    });

  clone
    .querySelectorAll<HTMLElement>('[data-testid="rating-histogram"]')
    .forEach((el) => {
      const fromAttr = Number(el.getAttribute('data-nonzero-buckets') || '');
      const buckets = Number.isFinite(fromAttr) && fromAttr > 0 ? fromAttr : 3;
      const height = ratingHistogramHeightPx(buckets);
      el.style.height = `${height}px`;
      el.style.minHeight = `${height}px`;
    });
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
    @page {
      size: portrait;
      margin: 16mm 14mm;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 0;
      background: #fff;
      color: #111827;
      font-family: "Segoe UI", ui-sans-serif, system-ui, -apple-system, Roboto, Helvetica, Arial, sans-serif;
      font-size: 10pt;
      line-height: 1.45;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    .print-header {
      margin: 0 0 20px;
      padding: 0 0 14px;
      border-bottom: 2px solid #3da4c0;
    }
    .print-eyebrow {
      margin: 0 0 6px;
      font-size: 8pt;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: #3da4c0;
    }
    .print-header h1 {
      font-size: 18pt;
      font-weight: 700;
      margin: 0;
      line-height: 1.2;
      color: #0f172a;
      letter-spacing: -0.01em;
    }
    .print-meta {
      display: flex;
      flex-wrap: wrap;
      gap: 6px 14px;
      margin-top: 10px;
      padding-top: 10px;
      border-top: 1px solid #e5e7eb;
      font-size: 8.5pt;
      color: #64748b;
    }
    .print-meta strong {
      color: #334155;
      font-weight: 600;
    }
    a { color: inherit !important; text-decoration: none !important; }
    a[href]::after { content: none !important; }

    [data-testid="survey-analytics-view"] {
      display: block !important;
      width: 100% !important;
      max-width: none !important;
    }
    [data-testid="survey-analytics-view"] > * + * {
      margin-top: 18px;
    }

    [data-print-only] {
      display: block !important;
      margin: 4px 0 10px !important;
      font-size: 9pt !important;
      font-weight: 700 !important;
      letter-spacing: 0.06em !important;
      text-transform: uppercase !important;
      color: #64748b !important;
      border: none !important;
      padding: 0 !important;
      background: transparent !important;
    }

    [data-testid="survey-analytics-summary"],
    [data-print-section="summary"] {
      display: grid !important;
      grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
      gap: 12px !important;
      margin-bottom: 4px !important;
    }
    [data-print-kpi] {
      break-inside: avoid;
      page-break-inside: avoid;
      border: 1px solid #e2e8f0 !important;
      border-left: 3px solid #3da4c0 !important;
      border-radius: 6px !important;
      background: #f8fafc !important;
      padding: 12px 14px !important;
      box-shadow: none !important;
      margin: 0 !important;
    }
    [data-print-kpi] p:first-child {
      font-size: 7.5pt !important;
      font-weight: 700 !important;
      letter-spacing: 0.06em !important;
      text-transform: uppercase !important;
      color: #64748b !important;
      margin: 0 !important;
    }
    [data-print-kpi] p:nth-child(2) {
      font-size: 18pt !important;
      font-weight: 700 !important;
      color: #0f172a !important;
      margin: 4px 0 0 !important;
      line-height: 1.15 !important;
    }
    [data-print-kpi] p:nth-child(3) {
      font-size: 8pt !important;
      color: #94a3b8 !important;
      margin: 4px 0 0 !important;
    }

    [data-testid="survey-analytics-view"] .grid {
      display: grid !important;
      gap: 12px !important;
    }
    [data-testid="survey-analytics-view"] .grid.sm\\:grid-cols-3,
    [data-testid="survey-analytics-view"] .grid-cols-1.sm\\:grid-cols-3 {
      grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
    }
    [data-testid="survey-analytics-view"] .grid.lg\\:grid-cols-2 {
      grid-template-columns: 1fr !important;
    }

    [data-testid="survey-analytics-view"] section,
    [data-testid="survey-analytics-view"] .rounded-card,
    [data-testid="survey-analytics-view"] .rounded-2xl {
      break-inside: avoid;
      page-break-inside: avoid;
      border: 1px solid #e2e8f0 !important;
      border-radius: 8px !important;
      background: #fff !important;
      padding: 14px 16px !important;
      box-shadow: none !important;
      margin-bottom: 14px !important;
    }
    [data-testid="survey-analytics-view"] [data-print-kpi].rounded-card,
    [data-testid="survey-analytics-view"] [data-print-kpi].rounded-2xl {
      margin-bottom: 0 !important;
      padding: 12px 14px !important;
    }

    [data-testid="survey-analytics-view"] h3 {
      font-size: 11pt !important;
      font-weight: 650 !important;
      color: #0f172a !important;
      margin: 0 !important;
      line-height: 1.35 !important;
    }
    /* Type badges only — do not restyle legend color dots (also rounded-full). */
    [data-testid="survey-analytics-view"] span.inline-block.rounded-full {
      background: #f1f5f9 !important;
      color: #475569 !important;
      border: 1px solid #e2e8f0 !important;
      font-size: 7.5pt !important;
      font-weight: 650 !important;
    }

    [data-testid="survey-analytics-view"] [data-testid="submissions-trend-chart"],
    [data-testid="survey-analytics-view"] [data-testid="choice-pie-chart"],
    [data-testid="survey-analytics-view"] [data-testid="rating-histogram"],
    [data-testid="survey-analytics-view"] [data-testid="choice-distribution-chart"] {
      width: 100% !important;
      max-width: 100% !important;
      break-inside: avoid !important;
      page-break-inside: avoid !important;
      overflow: visible !important;
    }
    [data-testid="survey-analytics-view"] [data-testid="choice-pie-chart"] {
      display: flex !important;
      justify-content: center !important;
      align-items: center !important;
    }
    [data-testid="survey-analytics-view"] [data-testid="choice-pie-chart"] .recharts-wrapper,
    [data-testid="survey-analytics-view"] [data-testid="choice-pie-chart"] svg {
      overflow: visible !important;
    }
    [data-testid="survey-analytics-view"] svg.recharts-surface {
      max-width: 100% !important;
      overflow: visible !important;
    }
    [data-testid="survey-analytics-view"] [data-testid="choice-pie-chart"] svg.recharts-surface {
      width: auto !important;
      height: auto !important;
      max-height: none !important;
    }
    [data-testid="survey-analytics-view"] .recharts-tooltip-wrapper {
      display: none !important;
    }

    [data-testid="survey-analytics-view"] section ul {
      margin-top: 12px !important;
      padding-top: 10px !important;
      border-top: 1px solid #eef2f7 !important;
      break-inside: avoid;
      page-break-inside: avoid;
    }
    [data-testid="survey-analytics-view"] section ul li {
      align-items: flex-start !important;
      gap: 8px !important;
      padding: 4px 0 !important;
      font-size: 9pt !important;
    }
    [data-testid="survey-analytics-view"] section ul li .truncate,
    [data-testid="survey-analytics-view"] section ul li span.truncate {
      overflow: visible !important;
      text-overflow: clip !important;
      white-space: normal !important;
    }
    [data-testid="survey-analytics-view"] section ul[data-print-show] {
      border-top: none !important;
      padding-top: 0 !important;
      margin-top: 8px !important;
    }
    [data-testid="survey-analytics-view"] section ul[data-print-show] li {
      border: 1px solid #eef2f7 !important;
      border-radius: 6px !important;
      background: #f8fafc !important;
      padding: 8px 10px !important;
      margin-bottom: 6px !important;
      font-size: 9pt !important;
      color: #334155 !important;
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
    <p class="print-eyebrow">Community Health · Survey analytics</p>
    <h1>${escapeHtml(title)}</h1>
    <div class="print-meta">
      <span><strong>Generated</strong> ${escapeHtml(generatedAt)}</span>
      <span><strong>Report</strong> Response analytics</span>
    </div>
  </header>
  ${analyticsHtml}
</body>
</html>`;
}

/**
 * Opens the system print preview (Save as PDF) via a same-document hidden
 * iframe — same preview flow as before.
 *
 * The iframe is loaded as about:blank so Chrome's "Headers and footers" URL
 * is not the admin SPA path. Browsers may still print date/title/about:blank
 * unless the user turns Headers and footers off in the print dialog.
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
  prepareAnalyticsPrintClone(clone);

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
  iframe.src = 'about:blank';
  iframe.style.position = 'fixed';
  iframe.style.left = '-10000px';
  iframe.style.top = '0';
  iframe.style.width = '816px';
  iframe.style.height = '1056px';
  iframe.style.border = '0';
  iframe.style.opacity = '0';
  iframe.style.pointerEvents = 'none';

  const cleanup = () => {
    document.title = previousTitle;
    iframe.remove();
  };

  let started = false;
  const writeAndPrint = () => {
    if (started) return;
    started = true;

    const frameWindow = iframe.contentWindow;
    const frameDocument = frameWindow?.document;
    if (!frameWindow || !frameDocument) {
      cleanup();
      return;
    }

    frameDocument.open();
    frameDocument.write(html);
    frameDocument.close();

    window.setTimeout(() => {
      try {
        frameWindow.focus();
        frameWindow.print();
      } finally {
        window.setTimeout(cleanup, 1000);
      }
    }, 250);
  };

  iframe.addEventListener('load', writeAndPrint, { once: true });
  document.body.appendChild(iframe);

  // about:blank is often already complete by append time (incl. unit tests).
  try {
    if (iframe.contentWindow?.document?.readyState === 'complete') {
      writeAndPrint();
    }
  } catch {
    // cross-origin guard — load listener remains the fallback
  }

  return true;
}

/** @deprecated Prefer printSurveyAnalyticsPdf */
export function printSurveyResponsesPdf(titleOrInput: string | { title: string }): boolean {
  const title = typeof titleOrInput === 'string' ? titleOrInput : titleOrInput.title;
  return printSurveyAnalyticsPdf(title);
}
