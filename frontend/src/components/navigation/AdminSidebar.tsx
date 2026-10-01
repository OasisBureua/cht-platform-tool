import { useNavigate } from 'react-router-dom';
import { LayoutGrid } from 'lucide-react';
import RailSidebar, { type RailEntry } from './RailSidebar';
import { ADMIN_NAV_ITEMS, isAdminNavGroup } from './adminNavItems';
import { useAuth } from '../../contexts/AuthContext';

/**
 * The admin console's rail, in the member app's style: Dashboard first,
 * the console's destinations, and Tools as a group that opens in place.
 * There's no admin bottom bar, so on phones the rail stays as icons.
 */
const SHORT: Record<string, string> = { 'Campaigns Dashboard': 'Campaigns' };

const ITEMS: RailEntry[] = [
  { to: '/admin', label: 'Dashboard', icon: LayoutGrid, end: true },
  ...ADMIN_NAV_ITEMS.map((e) =>
    isAdminNavGroup(e)
      ? {
          id: e.id,
          label: e.label,
          icon: e.icon,
          children: e.children.map(({ to, label, icon, end }) => ({ to, label: SHORT[label] ?? label, title: label, icon, end })),
        }
      : { to: e.to, label: e.label === 'LIVE' ? 'Live' : e.label, icon: e.icon, end: e.end },
  ),
];

export default function AdminSidebar() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  return (
    <RailSidebar
      homeTo="/admin"
      homeLabel="Community Health Media, admin home"
      items={ITEMS}
      storageKey="chm-admin-sidebar-collapsed"
      ariaLabel="Admin"
      alwaysVisible
      onLogout={() => {
        logout();
        navigate('/');
      }}
    />
  );
}
