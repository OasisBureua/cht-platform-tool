import { useQuery } from '@tanstack/react-query';
import { RefreshCw } from 'lucide-react';
import { adminApi } from '../../api/admin';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import {
  CampaignsDashboardSummary,
  CampaignsDashboardTable,
} from '../../components/admin/campaigns/CampaignsDashboardPanels';
import {
  CampaignsDashboardAlerts,
  CampaignsHubSpotSetupBanner,
} from '../../components/admin/campaigns/CampaignsHubSpotSetupBanner';

export default function AdminCampaignsDashboard() {
  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['admin', 'campaigns-dashboard'],
    queryFn: () => adminApi.getCampaignsDashboard(),
    staleTime: 60_000,
  });

  return (
    <div className="space-y-4 md:space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-balance text-xl font-bold tracking-tight text-gray-900 dark:text-zinc-100 md:text-2xl">
            Campaigns Dashboard
          </h1>
          <p className="mt-1 text-sm text-gray-600 dark:text-zinc-400">
            Live HubSpot campaign metrics merged with Content Hub campaign links.
          </p>
        </div>
        <button
          type="button"
          onClick={() => refetch()}
          disabled={isFetching}
          className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
        >
          <RefreshCw
            className={['h-4 w-4', isFetching ? 'animate-spin' : ''].join(' ')}
            aria-hidden
          />
          Refresh
        </button>
      </div>

      {isLoading ? <LoadingSpinner /> : null}

      {isError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200">
          {(error as Error)?.message ?? 'Failed to load campaign metrics.'}
        </div>
      ) : null}

      {data ? (
        <>
          <CampaignsHubSpotSetupBanner data={data} />
          <CampaignsDashboardSummary data={data} />
          <CampaignsDashboardAlerts warnings={data.warnings} />

          <section className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-zinc-100">
                Campaign breakdown
              </h2>
              <p className="text-xs text-gray-500 dark:text-zinc-400">
                Synced {new Date(data.syncedAt).toLocaleString()}
                {data.summary.campaignsFromCache != null &&
                data.summary.campaignsFromCache > 0
                  ? ` · ${data.summary.campaignsFromCache} from cache`
                  : ''}
                {' · '}
                Click a row for details
              </p>
            </div>
            <CampaignsDashboardTable campaigns={data.campaigns ?? []} />
          </section>
        </>
      ) : null}
    </div>
  );
}
