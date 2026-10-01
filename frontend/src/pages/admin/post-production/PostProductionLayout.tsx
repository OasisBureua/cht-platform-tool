import { NavLink, Outlet } from 'react-router-dom';
import { Image, LayoutPanelTop, Presentation, Scissors } from 'lucide-react';

/**
 * Admin › Post-production: the clipper and the CHM Studio (thumbnails,
 * social carousels and decks) in one place, with the platform's tabs across
 * the top. The studios draw with the CHM Studio pages; the controls are ours.
 */
const TABS = [
  { to: 'clipper', label: 'Clipper', icon: Scissors },
  { to: 'thumbnails', label: 'Thumbnails', icon: Image },
  { to: 'social', label: 'Social', icon: LayoutPanelTop },
  { to: 'deck', label: 'Deck', icon: Presentation },
] as const;

export default function PostProductionLayout() {
  return (
    <div className="space-y-4">
      {/* one compact row, so the workspace below gets the screen's height */}
      <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <p className="eyebrow text-anchor">Post-production</p>
          <h1 className="display text-body-l text-text md:text-display-s">Clips, thumbnails, social and decks</h1>
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
