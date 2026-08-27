import { NavLink, Outlet } from 'react-router-dom';

const TAB_CLASS = ({ isActive }: { isActive: boolean }) =>
  [
    'border-b-2 px-3 py-2 text-sm font-semibold transition-colors',
    isActive
      ? 'border-gray-900 text-foreground dark:border-zinc-100'
      : 'border-transparent text-muted-foreground hover:text-foreground',
  ].join(' ');

/**
 * Shared chrome for Campaigns Dashboard → Metrics | Funnel.
 * Campaign detail (`:campaignId`) stays outside this layout.
 */
export default function AdminCampaignsLayout() {
  return (
    <div className="space-y-4 md:space-y-6">
      <div>
        <h1 className="text-balance text-xl font-bold tracking-tight text-foreground md:text-2xl">
          Campaigns Dashboard
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          HubSpot campaign metrics and HCP sales funnel (registration → attendance → survey).
        </p>
        <div
          className="mt-4 flex gap-2 border-b border-border"
          role="tablist"
          aria-label="Campaigns Dashboard views"
        >
          <NavLink to="/admin/campaigns-dashboard" end className={TAB_CLASS} role="tab">
            Metrics
          </NavLink>
          <NavLink to="/admin/campaigns-dashboard/funnel" className={TAB_CLASS} role="tab">
            Funnel
          </NavLink>
        </div>
      </div>
      <Outlet />
    </div>
  );
}
