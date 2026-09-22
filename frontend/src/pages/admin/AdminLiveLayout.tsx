import { NavLink, Outlet } from 'react-router-dom';

const TAB_CLASS = ({ isActive }: { isActive: boolean }) =>
  [
    'border-b-2 px-3 py-2 text-sm font-semibold transition-colors',
    isActive
      ? 'border-gray-900 text-foreground dark:border-zinc-100'
      : 'border-transparent text-muted-foreground hover:text-foreground',
  ].join(' ');

/**
 * Shared chrome for LIVE → Sessions | Zoom Recordings.
 * Program Hub (`/admin/programs/:id/hub`) stays outside this layout.
 */
export default function AdminLiveLayout() {
  return (
    <div className="space-y-4 md:space-y-6">
      <div>
        <h1 className="text-balance text-xl font-bold tracking-tight text-foreground md:text-2xl">
          LIVE
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Webinar scheduling, Zoom-linked programs, and cloud recording catalog.
        </p>
        <div
          className="mt-4 flex gap-2 border-b border-border"
          role="tablist"
          aria-label="LIVE views"
        >
          <NavLink to="/admin/programs" end className={TAB_CLASS} role="tab">
            Sessions
          </NavLink>
          <NavLink to="/admin/programs/zoom-recordings" className={TAB_CLASS} role="tab">
            Zoom Recordings
          </NavLink>
        </div>
      </div>
      <Outlet />
    </div>
  );
}
