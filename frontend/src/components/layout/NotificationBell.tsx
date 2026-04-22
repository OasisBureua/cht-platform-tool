import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../contexts/AuthContext';
import { programsApi } from '../../api/programs';

export function NotificationBell() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const { data: items = [] } = useQuery({
    queryKey: ['programs', 'live-action-items'],
    queryFn: () => programsApi.getLiveActionItems(),
    enabled: !!user?.userId,
    staleTime: 30_000,
  });

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
          if (!open) queryClient.invalidateQueries({ queryKey: ['programs', 'live-action-items'] });
        }}
        className="relative p-2 min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0 flex items-center justify-center rounded-full text-gray-500 hover:text-gray-700 hover:bg-gray-100"
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
        {items.length > 0 ? (
          <span
            className="absolute top-1 right-1 min-w-[8px] h-2 px-0.5 rounded-full bg-red-500"
            aria-hidden
          />
        ) : null}
      </button>
      {open ? (
        <div className="absolute right-0 mt-2 w-[min(20rem,calc(100vw-2rem))] max-h-96 overflow-auto rounded-xl border border-gray-200 bg-white shadow-lg z-50 text-[100%]">
          <p className="px-4 py-2 text-xs font-semibold text-gray-500 border-b border-gray-100">LIVE follow-ups</p>
          {items.length === 0 ? (
            <p className="px-4 py-6 text-sm text-gray-600">
              No items yet. Reminders appear here after you are registered for a LIVE session (including admin approval
              when required), usually for post-event feedback.
            </p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {items.map((it) => (
                <li key={it.id}>
                  <Link
                    to={it.href}
                    onClick={() => setOpen(false)}
                    className="block px-4 py-3 hover:bg-gray-50"
                  >
                    <p className="text-sm font-medium text-gray-900">{it.title}</p>
                    <p className="text-xs text-gray-600 mt-0.5">{it.body}</p>
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
