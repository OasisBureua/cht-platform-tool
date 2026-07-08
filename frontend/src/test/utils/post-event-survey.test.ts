import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  buildPostEventSurveyEmbedSrc,
  isPostEventSurveyUnlocked,
} from '../../utils/post-event-survey';

describe('post-event-survey helpers', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  describe('buildPostEventSurveyEmbedSrc', () => {
    it('does not add identity query params by default', () => {
      expect(
        buildPostEventSurveyEmbedSrc(
          'https://communityhealthmedia.jotform.com/260698533879881',
        ),
      ).toBe('https://communityhealthmedia.jotform.com/260698533879881');
    });

    it('adds user_id and program_id only for legacy Jotform attribution', () => {
      expect(
        buildPostEventSurveyEmbedSrc(
          'https://communityhealthmedia.jotform.com/260698533879881',
          { legacyAttribution: true, userId: 'user-1', programId: 'prog-1' },
        ),
      ).toBe(
        'https://communityhealthmedia.jotform.com/260698533879881?user_id=user-1&program_id=prog-1',
      );
    });

    it('preserves existing query params with legacy attribution', () => {
      const url = buildPostEventSurveyEmbedSrc(
        'https://example.com/form?prefill=1',
        { legacyAttribution: true, userId: 'user-2', programId: 'prog-2' },
      );
      expect(url).toContain('prefill=1');
      expect(url).toContain('user_id=user-2');
      expect(url).toContain('program_id=prog-2');
    });
  });

  describe('isPostEventSurveyUnlocked', () => {
    it('unlocks when zoomSessionEndedAt is in the past', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-05-20T15:00:00Z'));
      expect(
        isPostEventSurveyUnlocked({
          zoomSessionType: 'WEBINAR',
          zoomSessionEndedAt: '2026-05-20T14:00:00Z',
        }),
      ).toBe(true);
    });

    it('locks webinars until scheduled end when webhook end time is missing', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-05-20T14:30:00Z'));
      expect(
        isPostEventSurveyUnlocked({
          zoomSessionType: 'WEBINAR',
          startDate: '2026-05-20T14:00:00Z',
          duration: 60,
        }),
      ).toBe(false);

      vi.setSystemTime(new Date('2026-05-20T15:05:00Z'));
      expect(
        isPostEventSurveyUnlocked({
          zoomSessionType: 'WEBINAR',
          startDate: '2026-05-20T14:00:00Z',
          duration: 60,
        }),
      ).toBe(true);
    });

    it('unlocks office hours meetings without scheduled end fallback', () => {
      expect(
        isPostEventSurveyUnlocked({
          zoomSessionType: 'MEETING',
        }),
      ).toBe(true);
    });
  });
});
