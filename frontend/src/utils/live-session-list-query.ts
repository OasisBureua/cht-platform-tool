import type { QueryClient } from '@tanstack/react-query';
import type { WebinarItem } from '../api/webinars';

export const LIVE_WEBINARS_QUERY_KEY = ['webinars'] as const;
export const OFFICE_HOURS_QUERY_KEY = ['office-hours'] as const;

/** Keep HCP live lists in sync shortly after admin publish/delete changes. */
export const liveSessionListQueryOptions = {
  staleTime: 30_000,
  refetchOnMount: 'always' as const,
};

export function isApiNotFoundError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null || !('response' in error)) return false;
  return (error as { response?: { status?: number } }).response?.status === 404;
}

/** Drop a removed session from cached schedule lists so stale cards disappear immediately. */
export function removeSessionFromLiveListCaches(
  queryClient: QueryClient,
  sessionId: string,
): void {
  for (const key of [LIVE_WEBINARS_QUERY_KEY, OFFICE_HOURS_QUERY_KEY]) {
    queryClient.setQueryData<WebinarItem[]>(key, (old) =>
      old?.filter((w) => w.id !== sessionId),
    );
  }
}
