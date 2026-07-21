import { afterEach, describe, expect, it, vi } from 'vitest';
import { printSurveyResponsesPdf } from '../../utils/survey-analytics-pdf';

describe('printSurveyResponsesPdf', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('uses a PDF-friendly document filename and restores the page title', () => {
    const originalTitle = document.title;
    let titleDuringPrint = '';
    const print = vi.spyOn(window, 'print').mockImplementation(() => {
      titleDuringPrint = document.title;
    });

    printSurveyResponsesPdf('Program One / Feedback');

    expect(print).toHaveBeenCalledOnce();
    expect(titleDuringPrint).toBe('Program-One-Feedback-survey-responses');
    expect(document.title).toBe(originalTitle);
  });
});
