import { describe, expect, it } from 'vitest';
import {
  surveyListStateFromSearchParams,
  surveyListStateToSearchParams,
  surveyListQueryIsActive,
  SURVEY_LIST_QUERY_DEFAULTS,
} from '../../utils/survey-list-query';

describe('survey-list-query', () => {
  it('parses filters and sort from the URL', () => {
    const params = new URLSearchParams(
      'q=cardio&program=p1&session=WEBINAR&status=no_responses&source=native&sort=completion&dir=asc',
    );
    expect(surveyListStateFromSearchParams(params)).toEqual({
      q: 'cardio',
      program: 'p1',
      session: 'WEBINAR',
      status: 'no_responses',
      source: 'native',
      sort: 'completion',
      dir: 'asc',
    });
  });

  it('falls back to defaults for unknown values', () => {
    expect(surveyListStateFromSearchParams(new URLSearchParams('status=nope'))).toEqual(
      SURVEY_LIST_QUERY_DEFAULTS,
    );
  });

  it('omits default values when serializing', () => {
    const params = surveyListStateToSearchParams(SURVEY_LIST_QUERY_DEFAULTS);
    expect(params.toString()).toBe('');
  });

  it('round-trips a filtered state', () => {
    const state = {
      q: 'beta',
      program: 'all',
      session: 'MEETING' as const,
      status: 'collecting' as const,
      source: 'jotform' as const,
      sort: 'responses' as const,
      dir: 'asc' as const,
    };
    const again = surveyListStateFromSearchParams(
      surveyListStateToSearchParams(state),
    );
    expect(again).toEqual(state);
    expect(surveyListQueryIsActive(state)).toBe(true);
  });

  it('keeps filters in the URL so list → detail → back can restore them', () => {
    // Smoke for SCRUM-291 AC: filters/sort persist across studio navigation.
    const listUrl = new URLSearchParams(
      'q=hcp&status=no_responses&sort=completion&dir=asc',
    );
    const restored = surveyListStateFromSearchParams(listUrl);
    expect(restored.q).toBe('hcp');
    expect(restored.status).toBe('no_responses');
    expect(restored.sort).toBe('completion');
    expect(surveyListStateToSearchParams(restored).toString()).toContain('q=hcp');
  });
});
