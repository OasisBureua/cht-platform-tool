import { describe, expect, it } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import {
  isApiNotFoundError,
  removeSessionFromLiveListCaches,
} from '../../utils/live-session-list-query';

describe('live-session-list-query', () => {
  it('detects axios 404 errors', () => {
    expect(isApiNotFoundError({ response: { status: 404 } })).toBe(true);
    expect(isApiNotFoundError({ response: { status: 500 } })).toBe(false);
    expect(isApiNotFoundError(new Error('nope'))).toBe(false);
  });

  it('removes a session from cached webinar and office-hours lists', () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(['webinars'], [
      { id: 'a', title: 'A' },
      { id: 'b', title: 'B' },
    ]);
    queryClient.setQueryData(['office-hours'], [{ id: 'b', title: 'B' }]);

    removeSessionFromLiveListCaches(queryClient, 'b');

    expect(queryClient.getQueryData(['webinars'])).toEqual([{ id: 'a', title: 'A' }]);
    expect(queryClient.getQueryData(['office-hours'])).toEqual([]);
  });
});
