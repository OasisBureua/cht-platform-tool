import { useState } from 'react';

/** How a studio lays out its slides beside the artwork; remembered per studio in this browser. */
export type StageView = 'rail' | 'strip' | 'grid';

export function useStageView(studio: string): [StageView, (v: StageView) => void] {
  const key = `chm-studio-view:${studio}`;
  const [view, setView] = useState<StageView>(() => {
    try {
      const v = window.localStorage.getItem(key);
      return v === 'strip' || v === 'grid' ? v : 'rail';
    } catch {
      return 'rail';
    }
  });
  const set = (v: StageView) => {
    setView(v);
    try {
      window.localStorage.setItem(key, v);
    } catch {
      /* ignore */
    }
  };
  return [view, set];
}
