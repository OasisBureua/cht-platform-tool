/**
 * Jotform thank-you redirect should use e.g. `...?submission_id={id}` ({id} is replaced by Jotform).
 * We accept common query keys and regex-match similar names.
 */
export function readIntakeSubmissionIdFromSearch(search: string): string | undefined {
  const q = new URLSearchParams(search);
  const keys = ['submission_id', 'submissionId', 'submissionID', 'jid', 'sid', 'submission'];
  for (const key of keys) {
    const v = q.get(key)?.trim();
    if (v) return v;
  }
  for (const [k, v] of q.entries()) {
    if (/^submission[_-]?id$/i.test(k) && v?.trim()) return v.trim();
  }
  return undefined;
}

/**
 * Build `/app/.../:id/register` for the current area so Jotform can redirect back to the wizard
 * (not the session detail page, which does not read submission ids).
 */
export function buildProgramRegisterHref(programId: string, pathname: string): string {
  if (pathname.includes('/chm-office-hours/')) {
    return `/app/chm-office-hours/${programId}/register`;
  }
  if (pathname.includes('/office-hours/')) {
    return `/app/office-hours/${programId}/register`;
  }
  if (pathname.includes('/webinars/')) {
    return `/app/webinars/${programId}/register`;
  }
  return `/app/live/${programId}/register`;
}

/** Multi-webinar registration wizard: persist selection across Jotform redirects. */
export const MULTI_REGISTER_STORAGE_KEY = 'cht:live-multi-register';

export type MultiRegisterPersistedState = {
  selectedIds: string[];
  intakeByProgramId: Record<string, string>;
  /** Highest intake step index the user has continued past (forward-only). */
  maxIntakeIndexCompleted: number;
  phase: 'select' | 'intake' | 'review';
  intakeIndex: number;
};

export function buildMultiRegisterHref(opts?: {
  intakeProgramId?: string;
  programIds?: string[];
}): string {
  const base = '/app/live/register-multiple';
  const q = new URLSearchParams();
  if (opts?.intakeProgramId?.trim()) {
    q.set('intakeProgramId', opts.intakeProgramId.trim());
  }
  if (opts?.programIds?.length) {
    q.set('programs', opts.programIds.join(','));
  }
  const qs = q.toString();
  return qs ? `${base}?${qs}` : base;
}

/** Read comma-separated program ids from multi-register URL. */
export function readMultiRegisterProgramIds(search: string): string[] {
  const raw = new URLSearchParams(search).get('programs')?.trim();
  if (!raw) return [];
  return raw
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);
}

export function readMultiRegisterIntakeProgramId(search: string): string | undefined {
  return new URLSearchParams(search).get('intakeProgramId')?.trim() || undefined;
}

export function loadMultiRegisterState(): MultiRegisterPersistedState | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(MULTI_REGISTER_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as MultiRegisterPersistedState;
    if (!parsed || !Array.isArray(parsed.selectedIds)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveMultiRegisterState(state: MultiRegisterPersistedState): void {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(MULTI_REGISTER_STORAGE_KEY, JSON.stringify(state));
}

export function clearMultiRegisterState(): void {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem(MULTI_REGISTER_STORAGE_KEY);
}
