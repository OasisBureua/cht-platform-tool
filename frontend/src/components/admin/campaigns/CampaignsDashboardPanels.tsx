import { Link, useNavigate } from 'react-router-dom';
import {
  BarChart3,
  Mail,
  MousePointerClick,
  Users,
  Eye,
  FileInput,
  Share2,
  CalendarCheck,
  ChevronRight,
} from 'lucide-react';
import type {
  CampaignMetricTotals,
  CampaignsDashboardResponse,
} from '../../../api/admin';
import { AdminMetricCard } from '../AdminMetricCard';
import { dataSourceBadgeClass, dataSourceLabel } from './campaignDataSource';
import { formatCount } from './campaignDashboardFormat';
import {
  campaignDashboardId,
  campaignDashboardPath,
} from './campaignDashboardPath';

const SUMMARY_METRICS: Array<{
  key: keyof CampaignMetricTotals;
  label: string;
  sub: string;
  icon: typeof Users;
}> = [
  {
    key: 'sessions',
    label: 'Sessions',
    sub: 'Attributed site sessions',
    icon: BarChart3,
  },
  {
    key: 'influencedContacts',
    label: 'Influenced contacts',
    sub: 'Contacts touched by campaigns',
    icon: Users,
  },
  {
    key: 'newContactsFirstTouch',
    label: 'New contacts (first touch)',
    sub: 'First-touch attribution',
    icon: Users,
  },
  {
    key: 'emailSent',
    label: 'Emails sent',
    sub: 'Marketing email volume',
    icon: Mail,
  },
  {
    key: 'emailOpens',
    label: 'Email opens',
    sub: 'Unique opens across emails',
    icon: Eye,
  },
  {
    key: 'emailClicks',
    label: 'Email clicks',
    sub: 'Clicks on marketing emails',
    icon: MousePointerClick,
  },
  {
    key: 'landingPageViews',
    label: 'Landing page views',
    sub: 'Landing + site page views',
    icon: Eye,
  },
  {
    key: 'formSubmissions',
    label: 'Form submissions',
    sub: 'Captured leads from forms',
    icon: FileInput,
  },
  {
    key: 'socialClicks',
    label: 'Social clicks',
    sub: 'Facebook, LinkedIn, X',
    icon: Share2,
  },
  {
    key: 'marketingEventRegistrations',
    label: 'Event registrations',
    sub: 'Marketing event sign-ups',
    icon: CalendarCheck,
  },
];

export function CampaignsDashboardSummary({
  data,
}: {
  data: CampaignsDashboardResponse;
}) {
  const { summary } = data;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <AdminMetricCard
          variant="brand"
          label="HubSpot campaigns"
          value={formatCount(summary.totalHubSpotCampaigns)}
          sub={`${formatCount(summary.campaignsWithMetricData ?? 0)} with metric data`}
          icon={<BarChart3 className="h-6 w-6 text-brand-700 dark:text-brand-300" />}
        />
        <AdminMetricCard
          label="Content Hub"
          value={
            !data.contentHub.configured
              ? 'Not configured'
              : data.contentHub.reachable
                ? formatCount(data.contentHub.totalCampaigns)
                : 'Unreachable'
          }
          sub={
            data.contentHub.reachable
              ? `${formatCount(data.contentHub.platformsAvailable)} platform datasets synced`
              : (data.contentHub.error ?? 'Set CONTENTHUB_BASE_URL + API key')
          }
          variant={
            data.contentHub.reachable ? 'success' : 'danger'
          }
        />
        <AdminMetricCard
          label="Reporting period"
          value={`${data.reportingPeriodStart}`}
          sub={`through ${data.reportingPeriodEnd}`}
        />
        <AdminMetricCard
          label="HubSpot account"
          value={
            !data.hubspot.connected
              ? 'Disconnected'
              : data.hubspot.marketingScopesGranted
                ? 'Connected'
                : 'Scopes missing'
          }
          sub={
            data.hubspot.marketingScopesGranted
              ? (data.hubspot.accountName ?? data.hubspot.portalId ?? '')
              : 'Add marketing.campaigns.read + marketing-email'
          }
          variant={
            data.hubspot.connected && data.hubspot.marketingScopesGranted
              ? 'success'
              : 'danger'
          }
        />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-5">
        {SUMMARY_METRICS.map(({ key, label, sub, icon: Icon }) => (
          <AdminMetricCard
            key={key}
            label={label}
            value={formatCount(summary[key] ?? 0)}
            sub={sub}
            icon={<Icon className="h-5 w-5 text-muted-foreground" />}
          />
        ))}
      </div>
    </div>
  );
}

export function CampaignsDashboardTable({
  campaigns,
}: {
  campaigns: CampaignsDashboardResponse['campaigns'];
}) {
  const navigate = useNavigate();

  if (!campaigns.length) {
    return (
      <div className="rounded-card border border-dashed border-border bg-card p-8 text-center">
        <p className="text-sm text-muted-foreground">
          No HubSpot campaigns found for this reporting window.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-card border border-border bg-card">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-border text-sm">
          <thead className="bg-muted">
            <tr>
              <th className="px-4 py-3 text-left font-semibold text-muted-foreground">
                Campaign
              </th>
              <th className="px-4 py-3 text-right font-semibold text-muted-foreground">
                Sessions
              </th>
              <th className="px-4 py-3 text-right font-semibold text-muted-foreground">
                Influenced
              </th>
              <th className="px-4 py-3 text-right font-semibold text-muted-foreground">
                Email sent
              </th>
              <th className="px-4 py-3 text-right font-semibold text-muted-foreground">
                Opens
              </th>
              <th className="px-4 py-3 text-right font-semibold text-muted-foreground">
                Clicks
              </th>
              <th className="px-4 py-3 text-right font-semibold text-muted-foreground">
                Survey
              </th>
              <th className="px-4 py-3 text-left font-semibold text-muted-foreground">
                Client
              </th>
              <th className="px-4 py-3 text-left font-semibold text-muted-foreground">
                Platforms
              </th>
              <th className="px-4 py-3 text-left font-semibold text-muted-foreground">
                Content Hub
              </th>
              <th className="px-4 py-3 text-right font-semibold text-muted-foreground">
                <span className="sr-only">Open</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-zinc-800">
            {campaigns.map((campaign) => {
              const rowKey = campaignDashboardId(campaign) ?? campaign.name;
              const detailPath = campaignDashboardPath(campaign);
              const canOpen = detailPath !== '/admin/campaigns-dashboard';
              const availablePlatforms = campaign.contentHubPlatformSnapshots.filter(
                (s) => s.status === 'available',
              ).length;

              return (
                <tr
                  key={rowKey}
                  role={canOpen ? 'link' : undefined}
                  tabIndex={canOpen ? 0 : undefined}
                  onClick={() => {
                    if (canOpen) navigate(detailPath);
                  }}
                  onKeyDown={(e) => {
                    if (!canOpen) return;
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      navigate(detailPath);
                    }
                  }}
                  className={[
                    'hover:bg-muted/80',
                    canOpen
                      ? 'cursor-pointer focus-visible:bg-brand-50/60 focus-visible:outline-none dark:focus-visible:bg-brand-950/20'
                      : '',
                  ].join(' ')}
                >
                  <td className="px-4 py-3">
                    <div className="font-medium text-foreground">
                      {campaign.name}
                    </div>
                    {campaign.hubspotCampaignId ? (
                      <div className="mt-0.5 font-mono text-xs text-muted-foreground">
                        {campaign.hubspotCampaignId}
                      </div>
                    ) : null}
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      {campaign.status || campaign.contentHubCampaignStatus ? (
                        <span className="text-xs text-muted-foreground">
                          {campaign.contentHubCampaignStatus ?? campaign.status}
                        </span>
                      ) : null}
                      <span
                        className={[
                          'inline-flex rounded-full px-2 py-0.5 text-xs font-medium',
                          dataSourceBadgeClass(campaign.dataSource),
                        ].join(' ')}
                      >
                        {dataSourceLabel(campaign.dataSource)}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {formatCount(campaign.metrics.sessions)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {formatCount(campaign.metrics.influencedContacts)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {formatCount(campaign.metrics.emailSent)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {formatCount(campaign.metrics.emailOpens)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {formatCount(campaign.metrics.emailClicks)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {campaign.survey ? (
                      <div>
                        <p className="tabular-nums font-semibold text-foreground">
                          {formatCount(
                            campaign.survey.jotformSubmissionCount ??
                              campaign.survey.totalResponses,
                          )}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {campaign.survey.jotformFormId ? 'Jotform' : 'CHT'}
                        </p>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {campaign.contentHubClientSponsor ?? '—'}
                  </td>
                  <td className="px-4 py-3">
                    {campaign.contentHubPlatforms.length ? (
                      <div className="flex flex-wrap gap-1">
                        {campaign.contentHubPlatforms.map((platform) => {
                          const snapshot = campaign.contentHubPlatformSnapshots.find(
                            (s) => s.platform === platform,
                          );
                          const ok = snapshot?.status === 'available';
                          return (
                            <span
                              key={platform}
                              className={[
                                'rounded-full px-2 py-0.5 text-[10px] font-medium uppercase',
                                ok
                                  ? 'bg-green-100 text-success dark:bg-green-950/40 dark:text-green-300'
                                  : 'bg-gray-100 text-gray-600 dark:bg-zinc-800 dark:text-zinc-400',
                              ].join(' ')}
                              title={
                                snapshot
                                  ? `${platform}: ${snapshot.status}${snapshot.rowCount != null ? ` (${snapshot.rowCount} rows)` : ''}`
                                  : platform
                              }
                            >
                              {platform}
                            </span>
                          );
                        })}
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        {availablePlatforms > 0
                          ? `${availablePlatforms} synced`
                          : '—'}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {campaign.contentHubCampaignId ? (
                      <Link
                        to={`/admin/content-hub/campaigns/${campaign.contentHubCampaignId}`}
                        onClick={(e) => e.stopPropagation()}
                        className="text-sm font-medium text-brand-700 hover:underline dark:text-brand-300"
                      >
                        {campaign.contentHubCampaignName ?? 'View report'}
                      </Link>
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        Not linked
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {campaign.hubspotCampaignId ? (
                        <Link
                          to={`/admin/campaigns-dashboard/funnel?campaign=${encodeURIComponent(campaign.hubspotCampaignId)}`}
                          onClick={(e) => e.stopPropagation()}
                          className="text-xs font-semibold text-brand-700 hover:underline dark:text-brand-300"
                        >
                          Funnel
                        </Link>
                      ) : null}
                      <ChevronRight
                        className="h-4 w-4 text-muted-foreground"
                        aria-hidden
                      />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
