import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  choicePieHeightPx,
  ratingHistogramHeightPx,
  submissionsTrendHeightPx,
} from '../../components/admin/survey-analytics/chartSizing';
import {
  prepareAnalyticsPrintClone,
  printSurveyAnalyticsPdf,
} from '../../utils/survey-analytics-pdf';

describe('chartSizing (sparse vs rich)', () => {
  it('shrinks pie / trend / rating when data is sparse', () => {
    expect(choicePieHeightPx(1)).toBe(140);
    expect(choicePieHeightPx(3)).toBe(180);
    expect(choicePieHeightPx(5)).toBe(220);

    expect(submissionsTrendHeightPx(1)).toBe(120);
    expect(submissionsTrendHeightPx(4)).toBe(148);
    expect(submissionsTrendHeightPx(10)).toBe(176);

    expect(ratingHistogramHeightPx(1)).toBe(120);
    expect(ratingHistogramHeightPx(3)).toBe(148);
    expect(ratingHistogramHeightPx(5)).toBe(176);
  });
});

describe('prepareAnalyticsPrintClone', () => {
  it('sizes horizontal bar charts from option count (avoids crushed 170px overlap)', () => {
    const root = document.createElement('div');
    root.innerHTML = `
      <section>
        <div data-testid="choice-distribution-chart" data-option-count="7" style="height: 50px"></div>
        <ul>
          <li>a</li><li>b</li><li>c</li><li>d</li><li>e</li><li>f</li><li>g</li>
        </ul>
      </section>
      <div data-testid="choice-pie-chart" data-nonzero-slices="5" style="height: 50px"></div>
      <div data-testid="submissions-trend-chart" data-point-count="1" style="height: 50px"></div>
      <div data-testid="rating-histogram" data-nonzero-buckets="1" style="height: 50px"></div>
      <h2 data-print-only hidden>Question results</h2>
    `;

    prepareAnalyticsPrintClone(root);

    expect(
      root.querySelector<HTMLElement>('[data-testid="choice-distribution-chart"]')?.style.height,
    ).toBe('308px');
    expect(
      root.querySelector<HTMLElement>('[data-testid="choice-pie-chart"]')?.style.height,
    ).toBe('220px');
    expect(
      root.querySelector<HTMLElement>('[data-testid="submissions-trend-chart"]')?.style.height,
    ).toBe('120px');
    expect(
      root.querySelector<HTMLElement>('[data-testid="rating-histogram"]')?.style.height,
    ).toBe('120px');
    expect(root.querySelector<HTMLElement>('[data-print-only]')?.style.display).toBe('block');
  });

  it('uses compact pie height for a single non-zero slice', () => {
    const root = document.createElement('div');
    root.innerHTML = `<div data-testid="choice-pie-chart" data-nonzero-slices="1"></div>`;
    prepareAnalyticsPrintClone(root);
    expect(
      root.querySelector<HTMLElement>('[data-testid="choice-pie-chart"]')?.style.height,
    ).toBe('140px');
  });

  it('strips Recharts clipPath on pie charts so print does not cut the donut', () => {
    const root = document.createElement('div');
    root.innerHTML = `
      <div data-testid="choice-pie-chart" data-nonzero-slices="5">
        <svg height="220">
          <defs><clipPath id="pie-clip"><rect width="100" height="100" /></clipPath></defs>
        </svg>
      </div>
    `;
    prepareAnalyticsPrintClone(root);
    expect(root.querySelector('clipPath')).toBeNull();
    expect(
      root.querySelector<HTMLElement>('[data-testid="choice-pie-chart"]')?.style.height,
    ).toBe('220px');
  });
});

describe('printSurveyAnalyticsPdf', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  it('opens print preview via a hidden about:blank iframe (no pop-up window)', async () => {
    document.body.innerHTML = `
      <div data-testid="survey-analytics-view">
        <div data-print-hide="true">
          <label>Segment by<select><option>No segmentation</option></select></label>
        </div>
        <div data-testid="survey-analytics-summary">
          <div data-print-kpi>TOTAL RESPONSES 1</div>
        </div>
        <section>
          <div data-testid="choice-distribution-chart" data-option-count="5"></div>
          <ul><li>a</li><li>b</li><li>c</li><li>d</li><li>e</li></ul>
        </section>
        <svg width="100" height="40"><text>chart</text></svg>
      </div>
    `;

    const write = vi.fn();
    const print = vi.fn();
    const close = vi.fn();
    const open = vi.fn();
    const focus = vi.fn();
    const frameWindow = {
      document: { open, write, close, readyState: 'complete' },
      focus,
      print,
    };
    const iframe = document.createElement('iframe');
    Object.defineProperty(iframe, 'contentWindow', {
      configurable: true,
      get: () => frameWindow,
    });
    const nativeCreateElement = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      if (tag === 'iframe') return iframe;
      return nativeCreateElement(tag);
    });
    const openSpy = vi.spyOn(window, 'open');
    vi.spyOn(window, 'setTimeout').mockImplementation(((cb: TimerHandler) => {
      if (typeof cb === 'function') cb();
      return 0 as unknown as number;
    }) as typeof setTimeout);
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation(((cb: FrameRequestCallback) => {
      cb(0);
      return 0;
    }) as typeof requestAnimationFrame);

    const previousTitle = document.title;
    const ok = printSurveyAnalyticsPdf('Program One / Feedback');
    expect(ok).toBe(true);

    // Print is scheduled after chart-ready wait (microtasks + mocked timers).
    await vi.waitFor(() => {
      expect(write).toHaveBeenCalledOnce();
    });

    expect(iframe.getAttribute('src') ?? iframe.src).toContain('about:blank');
    expect(openSpy).not.toHaveBeenCalled();
    const html = String(write.mock.calls[0]?.[0] ?? '');
    expect(html).toContain('Program One / Feedback');
    expect(html).toContain('Community Health');
    expect(html).toContain('Generated');
    expect(html).toContain('TOTAL RESPONSES 1');
    expect(html).not.toContain('print-footer');
    expect(html).not.toContain('Headers and footers');
    expect(html).not.toContain('Segment by');
    expect(html).toContain('height: 220px');
    expect(html).toContain('span.inline-block.rounded-full');
    expect(html).not.toMatch(
      /\[data-testid="survey-analytics-view"\] span\.rounded-full \{/,
    );
    expect(print).toHaveBeenCalledOnce();
    expect(document.title).toBe(previousTitle);
  });

  it('returns false when analytics view is missing', () => {
    expect(printSurveyAnalyticsPdf('Missing')).toBe(false);
  });
});
