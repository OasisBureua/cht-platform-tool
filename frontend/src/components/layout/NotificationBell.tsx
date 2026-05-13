import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../contexts/AuthContext';
import { programsApi } from '../../api/programs';
import { adminApi } from '../../api/admin';

export function NotificationBell() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const profileIncomplete = user?.profileComplete === false;
  const isAdmin = user?.role === 'ADMIN';

  const { data: items = [] } = useQuery({
    queryKey: ['programs', 'live-action-items'],
    queryFn: () => programsApi.getLiveActionItems(),
    enabled: !!user?.userId,
    staleTime: 30_000,
  });

  const { data: webhookImports = [] } = useQuery({
    queryKey: ['admin', 'webhook-imports'],
    queryFn: () => adminApi.getWebhookImports(),
    enabled: isAdmin,
    staleTime: 60_000,
  });

  const hasIndicator = (items.length > 0 || profileIncomplete || webhookImports.length > 0) && !!user?.userId;

  /** Open the panel once per login session when profession/NPI still required (cleared on logout). */
  useEffect(() => {
    if (!user?.userId || user.profileComplete !== false) return;
    try {
      if (typeof sessionStorage?.getItem !== 'function') return;
      if (sessionStorage.getItem('cht-profile-reminder-seen') === '1') return;
      sessionStorage.setItem('cht-profile-reminder-seen', '1');
    } catch {
      /* ignore */
    }
    setOpen(true);
  }, [user?.userId, user?.profileComplete]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  if (!user?.userId) return null;

  return (
    <div className="relative" ref={panelRef}>
      <button
        type="button"
        onClick={() => {
          setOpen((v) => !v);
          if (!open) {
            queryClient.invalidateQueries({ queryKey: ['programs', 'live-action-items'] });
            if (isAdmin) queryClient.invalidateQueries({ queryKey: ['admin', 'webhook-imports'] });
          }
        }}
        className="relative p-2 min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0 flex items-center justify-center rounded-full text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
        aria-label="Notifications"
        aria-expanded={open}
      >
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>
        {hasIndicator ? (
          <span
            className="absolute top-1 right-1 min-w-[8px] h-2 px-0.5 rounded-full bg-red-500"
            aria-hidden
          />
        ) : null}
      </button>
      {open ? (
        <div className="absolute right-0 mt-2 w-[min(22rem,calc(100vw-2rem))] max-h-[min(24rem,70vh)] overflow-y-auto overscroll-contain rounded-xl border border-gray-200 bg-white shadow-lg z-50 text-[100%] dark:border-zinc-700 dark:bg-zinc-900">
          <p className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-gray-500 border-b border-gray-100 dark:border-zinc-800 dark:text-zinc-400">
            Notifications
          </p>

          {profileIncomplete ? (
            <div className="border-b border-amber-200/80 bg-amber-50/90 px-4 py-3 dark:border-amber-900/50 dark:bg-amber-950/40">
              <p className="text-sm font-semibold text-amber-950 dark:text-amber-100">Add your profession and NPI</p>
              <p className="mt-1.5 text-sm leading-relaxed text-amber-900/90 dark:text-amber-200/90">
                You can use the app, but you must add your <strong>profession</strong> and <strong>NPI</strong> (where
                required) to stay eligible for <strong>payments and earnings</strong>. You will not be paid until this
                information is on file.
              </p>
              <Link
                to="/app/settings"
                onClick={() => setOpen(false)}
                className="mt-2 inline-flex min-h-[40px] items-center justify-center rounded-lg bg-amber-800 px-3 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-amber-900 dark:bg-amber-600 dark:hover:bg-amber-500"
              >
                Complete required profile
              </Link>
            </div>
          ) : null}

          {isAdmin && webhookImports.length > 0 ? (
            <>
              <p className="px-4 py-2 text-xs font-semibold text-gray-500 border-b border-gray-100 dark:border-zinc-800 dark:text-zinc-400">
                Admin — Zoom imports need review
              </p>
              <ul className="divide-y divide-gray-100 dark:divide-zinc-800">
                {webhookImports.map((prog) => (
                  <li key={prog.id}>
                    <Link
                      to={`/admin/programs/${prog.id}`}
                      onClick={() => setOpen(false)}
                      className="block px-4 py-3 hover:bg-orange-50 dark:hover:bg-orange-950/30"
                    >
                      <p className="text-sm font-medium text-gray-900 dark:text-zinc-100">{prog.title}</p>
                      <p className="text-xs text-orange-700 dark:text-orange-400 mt-0.5">
                        Imported from Zoom
                        {prog.startDate
                          ? ` · ${new Date(prog.startDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`
                          : ''}
                      </p>
                      {prog.missingFields.length > 0 ? (
                        <p className="text-xs text-gray-500 dark:text-zinc-500 mt-0.5">
                          Missing: {prog.missingFields.join(', ')}
                        </p>
                      ) : null}
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          ) : null}

          <p className="px-4 py-2 text-xs font-semibold text-gray-500 border-b border-gray-100 dark:border-zinc-800 dark:text-zinc-400">
            Live follow-ups
          </p>
          {items.length === 0 ? (
            <p className="px-4 py-4 text-sm text-gray-600 dark:text-zinc-400">
              All caught up. Live session reminders (e.g. post-event surveys) appear here after you enroll—or after
              approval, if required.
            </p>
          ) : (
            <ul className="divide-y divide-gray-100 dark:divide-zinc-800">
              {items.map((it) => (
                <li key={it.id}>
                  <Link
                    to={it.href}
                    onClick={() => setOpen(false)}
                    className="block px-4 py-3 hover:bg-gray-50 dark:hover:bg-zinc-800/80"
                  >
                    <p className="text-sm font-medium text-gray-900 dark:text-zinc-100">{it.title}</p>
                    <p className="text-xs text-gray-600 dark:text-zinc-400 mt-0.5">{it.body}</p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
