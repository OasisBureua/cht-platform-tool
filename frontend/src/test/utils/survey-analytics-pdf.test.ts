import { afterEach, describe, expect, it, vi } from 'vitest';
import { printSurveyAnalyticsPdf } from '../../utils/survey-analytics-pdf';

describe('printSurveyAnalyticsPdf', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  it('prints via a hidden iframe without opening a pop-up window', () => {
    document.body.innerHTML = `
      <div data-testid="survey-analytics-view">
        <div data-print-hide="true">
          <label>Segment by<select><option>No segmentation</option></select></label>
        </div>
        <div class="summary">TOTAL RESPONSES 1</div>
        <svg width="100" height="40"><text>chart</text></svg>
      </div>
    `;

    const write = vi.fn();
    const print = vi.fn();
    const close = vi.fn();
    const open = vi.fn();
    const focus = vi.fn();
    const frameWindow = { document: { open, write, close }, focus, print };
    const iframe = document.createElement('iframe');
    Object.defineProperty(iframe, 'contentWindow', {
      configurable: true,
      get: () => frameWindow,
    });
    const nativeCreateElement = document.createElement.bind(document);
    const createElement = vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      if (tag === 'iframe') return iframe;
      return nativeCreateElement(tag);
    });
    const openSpy = vi.spyOn(window, 'open');
    vi.spyOn(window, 'setTimeout').mockImplementation(((cb: TimerHandler) => {
      if (typeof cb === 'function') cb();
      return 0 as unknown as number;
    }) as typeof setTimeout);

    const previousTitle = document.title;
    const ok = printSurveyAnalyticsPdf('Program One / Feedback');

    expect(ok).toBe(true);
    expect(openSpy).not.toHaveBeenCalled();
    expect(createElement).toHaveBeenCalledWith('iframe');
    expect(write).toHaveBeenCalledOnce();
    const html = String(write.mock.calls[0]?.[0] ?? '');
    expect(html).toContain('Program One / Feedback');
    expect(html).toContain('Survey analytics');
    expect(html).toContain('TOTAL RESPONSES 1');
    expect(html).toContain('<svg');
    expect(html).not.toContain('Segment by');
    expect(html).not.toContain('Individual responses');
    expect(print).toHaveBeenCalledOnce();
    expect(document.title).toBe(previousTitle);
  });

  it('returns false when analytics view is missing', () => {
    expect(printSurveyAnalyticsPdf('Missing')).toBe(false);
  });
});
