import { LayoutGrid } from 'lucide-react';
import { MARKETING_SITE_URL } from '../../config/app-urls';
import RailSidebar from './RailSidebar';
import { getAppNavItems } from './appNavItems';

/** The member app's rail: Dashboard first, then the app destinations. */
const DASHBOARD_ITEM = { to: '/app/home', label: 'Dashboard', icon: LayoutGrid, end: true };

export default function AppSidebar() {
  return (
    <RailSidebar
      homeTo={MARKETING_SITE_URL}
      homeLabel="Community Health Media, home"
      items={[DASHBOARD_ITEM, ...getAppNavItems()]}
      storageKey="chm-app-sidebar-collapsed"
    />
  );
}
