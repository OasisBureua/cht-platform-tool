import { useCallback, useEffect, useState } from 'react';
import {
  LIVE_SESSION_SORT_DEFAULT,
  type LiveSessionSortKey,
  readSessionSort,
  writeSessionSort,
} from '../utils/live-session-list-sort';

/**
 * Session-persisted sort for live webinar / office-hours lists.
 * Survives opening an event and navigating back within the same tab.
 */
export function useLiveSessionListSort(storageKey: string): {
  sortKey: LiveSessionSortKey;
  setSortKey: (key: LiveSessionSortKey) => void;
  isDefault: boolean;
} {
  const [sortKey, setSortKeyState] = useState<LiveSessionSortKey>(() =>
    readSessionSort(storageKey),
  );

  useEffect(() => {
    setSortKeyState(readSessionSort(storageKey));
  }, [storageKey]);

  const setSortKey = useCallback(
    (key: LiveSessionSortKey) => {
      setSortKeyState(key);
      writeSessionSort(storageKey, key);
    },
    [storageKey],
  );

  return {
    sortKey,
    setSortKey,
    isDefault: sortKey === LIVE_SESSION_SORT_DEFAULT,
  };
}
