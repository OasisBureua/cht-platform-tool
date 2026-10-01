import { LayoutGrid } from 'lucide-react';
import RailSidebar from './RailSidebar';
import { getAppNavItems } from './appNavItems';
import { useAuth } from '../../contexts/AuthContext';

/** The member app's rail: Dashboard first, then the app destinations. */
const DASHBOARD_ITEM = { to: '/app/home', label: 'Dashboard', icon: LayoutGrid, end: true };

export default function AppSidebar() {
  const { logout } = useAuth();
  return (
    <RailSidebar
      homeTo="/app/home"
      homeLabel="Community Health Media, app home"
      items={[DASHBOARD_ITEM, ...getAppNavItems()]}
      storageKey="chm-app-sidebar-collapsed"
      onLogout={() => logout()}
    />
  );
}
