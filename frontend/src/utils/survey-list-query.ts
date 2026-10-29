/**
 * SCRUM-291: persist survey list search / filters / sort in the URL so
 * navigating back from a detail page restores the instrument panel.
 */

export type SurveyListStatusFilter = 'all' | 'no_responses' | 'collecting';
export type SurveyListSourceFilter = 'all' | 'native' | 'jotform';
export type SurveyListSessionFilter = 'all' | 'WEBINAR' | 'MEETING';
export type SurveyListSortField =
  | 'name'
  | 'created'
  | 'responses'
  | 'completion';
export type SurveyListSortDir = 'asc' | 'desc';

export type SurveyListQueryState = {
  q: string;
  program: string;
  session: SurveyListSessionFilter;
  status: SurveyListStatusFilter;
  source: SurveyListSourceFilter;
  sort: SurveyListSortField;
  dir: SurveyListSortDir;
};

export const SURVEY_LIST_QUERY_DEFAULTS: SurveyListQueryState = {
  q: '',
  program: 'all',
  session: 'all',
  status: 'all',
  source: 'all',
  sort: 'created',
  dir: 'desc',
};

function one(params: URLSearchParams, key: string): string {
  return (params.get(key) ?? '').trim();
}

export function surveyListStateFromSearchParams(
  params: URLSearchParams,
): SurveyListQueryState {
  const q = one(params, 'q');
  const program = one(params, 'program') || 'all';
  const sessionRaw = one(params, 'session');
  const session: SurveyListSessionFilter =
    sessionRaw === 'WEBINAR' || sessionRaw === 'MEETING' ? sessionRaw : 'all';
  const statusRaw = one(params, 'status');
  const status: SurveyListStatusFilter =
    statusRaw === 'no_responses' || statusRaw === 'collecting'
      ? statusRaw
      : 'all';
  const sourceRaw = one(params, 'source');
  const source: SurveyListSourceFilter =
    sourceRaw === 'native' || sourceRaw === 'jotform' ? sourceRaw : 'all';
  const sortRaw = one(params, 'sort');
  const sort: SurveyListSortField =
    sortRaw === 'name' ||
    sortRaw === 'created' ||
    sortRaw === 'responses' ||
    sortRaw === 'completion'
      ? sortRaw
      : 'created';
  const dirRaw = one(params, 'dir');
  const dir: SurveyListSortDir = dirRaw === 'asc' ? 'asc' : 'desc';
  return { q, program, session, status, source, sort, dir };
}

/** Build search params; omit defaults so the URL stays clean. */
export function surveyListStateToSearchParams(
  state: SurveyListQueryState,
): URLSearchParams {
  const params = new URLSearchParams();
  const q = state.q.trim();
  if (q) params.set('q', q);
  if (state.program !== 'all') params.set('program', state.program);
  if (state.session !== 'all') params.set('session', state.session);
  if (state.status !== 'all') params.set('status', state.status);
  if (state.source !== 'all') params.set('source', state.source);
  const sortChanged = state.sort !== SURVEY_LIST_QUERY_DEFAULTS.sort;
  const dirChanged = state.dir !== SURVEY_LIST_QUERY_DEFAULTS.dir;
  if (sortChanged || dirChanged) {
    params.set('sort', state.sort);
    params.set('dir', state.dir);
  }
  return params;
}

export function surveyListQueryIsActive(state: SurveyListQueryState): boolean {
  return (
    state.q.trim() !== '' ||
    state.program !== 'all' ||
    state.session !== 'all' ||
    state.status !== 'all' ||
    state.source !== 'all' ||
    state.sort !== SURVEY_LIST_QUERY_DEFAULTS.sort ||
    state.dir !== SURVEY_LIST_QUERY_DEFAULTS.dir
  );
}
