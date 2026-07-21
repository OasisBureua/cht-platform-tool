import { afterEach, describe, expect, it, vi } from 'vitest';
import { printSurveyAnalyticsPdf } from '../../utils/survey-analytics-pdf';

describe('printSurveyAnalyticsPdf', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  it('prints a cloned analytics view without individual responses or controls', () => {
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
    const win = {
      document: { open: vi.fn(), write, close: vi.fn() },
      focus: vi.fn(),
      print: vi.fn(),
      close: vi.fn(),
      setTimeout: vi.fn((cb: () => void) => {
        cb();
        return 0 as unknown as number;
      }),
    };
    vi.spyOn(window, 'open').mockReturnValue(win as unknown as Window);

    const opened = printSurveyAnalyticsPdf('Program One / Feedback');

    expect(opened).toBe(true);
    const html = String(write.mock.calls[0]?.[0] ?? '');
    expect(html).toContain('Program One / Feedback');
    expect(html).toContain('Survey analytics');
    expect(html).toContain('TOTAL RESPONSES 1');
    expect(html).toContain('<svg');
    expect(html).not.toContain('Segment by');
    expect(html).not.toContain('<select');
    expect(html).not.toContain('Individual responses');
    expect(html).not.toContain('Response 1:');
    expect(win.print).toHaveBeenCalledOnce();
  });

  it('returns false when analytics view is missing or pop-up is blocked', () => {
    expect(printSurveyAnalyticsPdf('Missing')).toBe(false);
    document.body.innerHTML = `<div data-testid="survey-analytics-view"><div>ok</div></div>`;
    vi.spyOn(window, 'open').mockReturnValue(null);
    expect(printSurveyAnalyticsPdf('Blocked')).toBe(false);
  });
});
