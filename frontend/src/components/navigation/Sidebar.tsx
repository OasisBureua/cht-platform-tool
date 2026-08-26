import { NavLink } from 'react-router-dom';
import { Presentation, ClipboardList, Video, DollarSign, Settings } from 'lucide-react';

const nav = [
  { to: '/webinars', label: 'Webinars', icon: Presentation },
  { to: '/surveys', label: 'Surveys', icon: ClipboardList },
  { to: '/catalog', label: 'Conversations', icon: Video },
  { to: '/earnings', label: 'Earnings', icon: DollarSign },
  { to: '/settings', label: 'Settings', icon: Settings },
];

export default function Sidebar() {
  return (
    <aside className="hidden md:flex md:w-64 md:flex-col border-r border-border bg-card">
      <div className="px-5 py-4 border-b border-border">
        <div className="text-2xl font-bold text-brand-600">CHT Platform</div>
        <div className="text-xs text-muted-foreground">HCP Content Platform</div>
      </div>

      <nav className="p-3 space-y-1">
        {nav.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              [
                'flex items-center gap-3 rounded-[6px] px-3 py-2 text-sm font-medium transition',
                isActive ? 'bg-muted text-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              ].join(' ')
            }
          >
            <Icon className="h-4 w-4" />
            {label}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
