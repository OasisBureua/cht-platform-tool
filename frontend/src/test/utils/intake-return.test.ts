import { describe, it, expect } from 'vitest';
import {
  buildMultiRegisterHref,
  buildProgramRegisterHref,
  readIntakeSubmissionIdFromSearch,
  readMultiRegisterIntakeProgramId,
} from '../../utils/intake-return';

describe('intake-return helpers', () => {
  describe('readIntakeSubmissionIdFromSearch', () => {
    it('reads common submission id query keys', () => {
      expect(readIntakeSubmissionIdFromSearch('?submission_id=sub-123')).toBe(
        'sub-123',
      );
      expect(readIntakeSubmissionIdFromSearch('?submissionId=sub-456')).toBe(
        'sub-456',
      );
    });

    it('matches submission-id style keys case-insensitively', () => {
      expect(readIntakeSubmissionIdFromSearch('?Submission-ID=sub-789')).toBe(
        'sub-789',
      );
    });

    it('returns undefined when no submission id is present', () => {
      expect(readIntakeSubmissionIdFromSearch('?foo=bar')).toBeUndefined();
    });
  });

  describe('buildProgramRegisterHref', () => {
    it('routes live webinars to the live register wizard', () => {
      expect(buildProgramRegisterHref('prog-1', '/app/live/prog-1')).toBe(
        '/app/live/prog-1/register',
      );
    });

    it('routes office hours paths to office hours register', () => {
      expect(
        buildProgramRegisterHref('prog-2', '/app/chm-office-hours/prog-2'),
      ).toBe('/app/chm-office-hours/prog-2/register');
    });
  });

  describe('multi-register href helpers', () => {
    it('builds multi-register base and intake deep links', () => {
      expect(buildMultiRegisterHref()).toBe('/app/live/register-multiple');
      expect(buildMultiRegisterHref('prog-a')).toBe(
        '/app/live/register-multiple?intakeProgramId=prog-a',
      );
    });

    it('reads intakeProgramId from search params', () => {
      expect(
        readMultiRegisterIntakeProgramId('?intakeProgramId=prog-b&step=2'),
      ).toBe('prog-b');
    });
  });
});
