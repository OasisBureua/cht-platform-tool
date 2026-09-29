import { NavLink, Outlet } from 'react-router-dom';
import { Image, LayoutPanelTop, Scissors } from 'lucide-react';

/**
 * Admin › Post-production: the clipper and the CHM Studio (thumbnails and
 * social posts) in one place, with the platform's tabs across the top.
 */
const TABS = [
  { to: 'clipper', label: 'Clipper', icon: Scissors },
  { to: 'thumbnails', label: 'Thumbnails', icon: Image },
  { to: 'social', label: 'Social', icon: LayoutPanelTop },
] as const;

export default function PostProductionLayout() {
  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow text-anchor">Post-production</p>
          <h1 className="display mt-1 text-display-s text-text md:text-display-m">Clips, thumbnails and social</h1>
        </div>
        <nav aria-label="Post-production tools" className="flex gap-1 rounded-[10px] bg-surface-2 p-1">
          {TABS.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                [
                  'inline-flex h-9 items-center gap-2 rounded-[8px] px-3.5 text-body-s transition-colors',
                  isActive ? 'bg-surface font-medium text-text shadow-card' : 'text-muted2 hover:text-text',
                ].join(' ')
              }
            >
              <Icon className="size-4" aria-hidden />
              {label}
            </NavLink>
          ))}
        </nav>
      </header>
      <Outlet />
    </div>
  );
}
