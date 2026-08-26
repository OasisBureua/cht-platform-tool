import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  BarChart3,
  Building2,
  CalendarCheck,
  CalendarRange,
  ExternalLink,
  Eye,
  FileInput,
  Mail,
  MousePointerClick,
  Share2,
  Users,
} from 'lucide-react';
import { adminApi, type CampaignMetricTotals } from '../../api/admin';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import { AdminMetricCard } from '../../components/admin/AdminMetricCard';
import {
  dataSourceBadgeClass,
  dataSourceLabel,
} from '../../components/admin/campaigns/campaignDataSource';
import {
  InfoTile,
  PlatformsTable,
  SocialPostsTable,
  SurveysTable,
  TranscriptsTable,
  VideosTable,
} from '../../components/admin/campaigns/CampaignDetailSections';
import {
  formatCount,
  formatDate,
} from '../../components/admin/campaigns/campaignDashboardFormat';
import { findCampaignByDashboardId } from '../../components/admin/campaigns/campaignDashboardPath';

const DETAIL_METRICS: Array<{
  key: keyof CampaignMetricTotals;
  label: string;
  sub: string;
  icon: typeof Users;
}> = [
  { key: 'sessions', label: 'Sessions', sub: 'Attributed site sessions', icon: BarChart3 },
  { key: 'influencedContacts', label: 'Influenced contacts', sub: 'Contacts touched', icon: Users },
  {
    key: 'newContactsFirstTouch',
    label: 'New contacts (1st touch)',
    sub: 'First-touch attribution',
    icon: Users,
  },
  {
    key: 'newContactsLastTouch',
    label: 'New contacts (last touch)',
    sub: 'Last-touch attribution',
    icon: Users,
  },
  { key: 'emailSent', label: 'Emails sent', sub: 'Marketing email volume', icon: Mail },
  { key: 'emailOpens', label: 'Email opens', sub: 'Open events', icon: Eye },
  { key: 'emailClicks', label: 'Email clicks', sub: 'Click events', icon: MousePointerClick },
  {
    key: 'landingPageViews',
    label: 'Landing page views',
    sub: 'Landing + site pages',
    icon: Eye,
  },
  { key: 'formSubmissions', label: 'Form submissions', sub: 'Captured leads', icon: FileInput },
  { key: 'socialClicks', label: 'Social clicks', sub: 'Social engagement', icon: Share2 },
  {
    key: 'marketingEventRegistrations',
    label: 'Event registrations',
    sub: 'Marketing events',
    icon: CalendarCheck,
  },
];

type CampaignDetailTab =
  | 'social'
  | 'videos'
  | 'surveys'
  | 'transcripts'
  | 'platforms';

export default function AdminCampaignDetail() {
  const { campaignId } = useParams<{ campaignId: string }>();
  const [tab, setTab] = useState<CampaignDetailTab>('social');

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['admin', 'campaigns-dashboard'],
    queryFn: () => adminApi.getCampaignsDashboard(),
    staleTime: 60_000,
  });

  const campaign =
    data && campaignId
      ? findCampaignByDashboardId(data.campaigns ?? [], campaignId)
      : undefined;

  if (isLoading) return <LoadingSpinner />;

  if (isError) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200">
        {(error as Error)?.message ?? 'Failed to load campaign details.'}
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="space-y-4">
        <BackLink />
        <div className="rounded-xl border border-dashed border-border bg-card p-8 text-center">
          <p className="text-sm text-muted-foreground">
            Campaign not found in the current dashboard snapshot.
          </p>
          <Link
            to="/admin/campaigns-dashboard"
            className="mt-3 inline-block text-sm font-medium text-brand-700 hover:underline dark:text-brand-300"
          >
            Return to Campaigns Dashboard
          </Link>
        </div>
      </div>
    );
  }

  const assetEntries = Object.entries(campaign.assetCounts ?? {}).filter(
    ([, count]) => count > 0,
  );
  const videoViews = campaign.videos.reduce((sum, video) => sum + (video.views ?? 0), 0);
  const socialClicksFromPosts = campaign.socialPosts.reduce(
    (sum, post) => sum + (post.totalClicks ?? 0),
    0,
  );

  return (
    <div className="space-y-6 md:space-y-8">
      <div className="space-y-3">
        <BackLink />
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-balance text-xl font-bold tracking-tight text-foreground md:text-2xl">
              {campaign.name}
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span
                className={[
                  'inline-flex rounded-full px-2 py-0.5 text-xs font-medium',
                  dataSourceBadgeClass(campaign.dataSource),
                ].join(' ')}
              >
                {dataSourceLabel(campaign.dataSource)}
              </span>
              {(campaign.contentHubCampaignStatus ?? campaign.status) ? (
                <span className="text-xs text-muted-foreground">
                  {campaign.contentHubCampaignStatus ?? campaign.status}
                </span>
              ) : null}
            </div>
          </div>
          {campaign.contentHubCampaignId ? (
            <Link
              to={`/admin/content-hub/campaigns/${campaign.contentHubCampaignId}`}
              className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-700"
            >
              Open in Content Hub
              <ExternalLink className="h-4 w-4" aria-hidden />
            </Link>
          ) : null}
        </div>
      </div>

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <InfoTile
          icon={<Building2 className="h-4 w-4" />}
          label="Client / sponsor"
          value={campaign.contentHubClientSponsor ?? '—'}
        />
        <InfoTile
          icon={<CalendarRange className="h-4 w-4" />}
          label="Reporting period"
          value={
            campaign.reportingPeriodStart || campaign.reportingPeriodEnd
              ? `${campaign.reportingPeriodStart ?? '…'} → ${campaign.reportingPeriodEnd ?? '…'}`
              : '—'
          }
        />
        <InfoTile
          label="HubSpot campaign ID"
          value={campaign.hubspotCampaignId ?? 'Not linked'}
          mono
        />
        <InfoTile label="Last HubSpot sync" value={formatDate(campaign.hubspotSyncedAt)} />
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-foreground">
          Campaign metrics
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-4">
          {DETAIL_METRICS.map(({ key, label, sub, icon: Icon }) => (
            <AdminMetricCard
              key={key}
              label={label}
              value={formatCount(campaign.metrics[key] ?? 0)}
              sub={sub}
              icon={<Icon className="h-5 w-5 text-muted-foreground" />}
            />
          ))}
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <button type="button" className="text-left" onClick={() => setTab('social')}>
          <AdminMetricCard
            label="Social posts"
            value={formatCount(campaign.socialPosts.length)}
            sub={
              campaign.socialPosts.length
                ? `${formatCount(socialClicksFromPosts)} total clicks`
                : 'Awaiting HubSpot assets'
            }
            className={tab === 'social' ? 'ring-2 ring-brand-500/40' : ''}
          />
        </button>
        <button type="button" className="text-left" onClick={() => setTab('videos')}>
          <AdminMetricCard
            label="Videos"
            value={formatCount(campaign.videos.length)}
            sub={
              campaign.videos.length
                ? `${formatCount(videoViews)} views`
                : 'Available when content is linked'
            }
            className={tab === 'videos' ? 'ring-2 ring-brand-500/40' : ''}
          />
        </button>
        <button type="button" className="text-left" onClick={() => setTab('surveys')}>
          <AdminMetricCard
            label="Survey responses"
            value={
              campaign.survey
                ? formatCount(
                    campaign.survey.jotformSubmissionCount ??
                      campaign.survey.totalResponses,
                  )
                : '—'
            }
            sub={campaign.survey ? campaign.survey.title : 'No survey linked'}
            className={tab === 'surveys' ? 'ring-2 ring-brand-500/40' : ''}
          />
        </button>
        <button type="button" className="text-left" onClick={() => setTab('transcripts')}>
          <AdminMetricCard
            label="Transcripts"
            value={formatCount(campaign.transcripts.length)}
            sub={
              campaign.transcripts.length
                ? `${formatCount(campaign.transcripts.filter((t) => t.available).length)} available`
                : 'Available when content is linked'
            }
            className={tab === 'transcripts' ? 'ring-2 ring-brand-500/40' : ''}
          />
        </button>
      </section>

      {assetEntries.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-foreground">
            HubSpot assets
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {assetEntries.map(([type, count]) => (
              <div
                key={type}
                className="rounded-xl border border-border bg-card px-4 py-3"
              >
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {type.replace(/_/g, ' ')}
                </p>
                <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">
                  {formatCount(count)}
                </p>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section className="space-y-4">
        <div className="border-b border-border">
          <nav className="-mb-px flex flex-wrap gap-x-6 gap-y-1" aria-label="Campaign detail views">
            {(
              [
                {
                  key: 'social',
                  label: 'Social posts',
                  count: campaign.socialPosts.length,
                },
                {
                  key: 'videos',
                  label: 'Videos',
                  count: campaign.videos.length,
                },
                {
                  key: 'surveys',
                  label: 'Surveys',
                  count: campaign.survey ? 1 : 0,
                },
                {
                  key: 'transcripts',
                  label: 'Transcripts',
                  count: campaign.transcripts.length,
                },
                {
                  key: 'platforms',
                  label: 'Content Hub platforms',
                  count:
                    campaign.contentHubPlatforms.length ||
                    campaign.contentHubPlatformSnapshots.length,
                },
              ] as const
            ).map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setTab(item.key)}
                aria-current={tab === item.key ? 'page' : undefined}
                className={[
                  'border-b-2 px-1 pb-3 text-sm font-semibold transition-colors',
                  tab === item.key
                    ? 'border-gray-900 text-foreground dark:border-zinc-100'
                    : 'border-transparent text-muted-foreground hover:border-border hover:text-foreground',
                ].join(' ')}
              >
                {item.label}
                <span className="ml-2 tabular-nums text-xs font-medium text-muted-foreground">
                  {formatCount(item.count)}
                </span>
              </button>
            ))}
          </nav>
        </div>

        {tab === 'social' ? (
          <SocialPostsTable posts={campaign.socialPosts} />
        ) : tab === 'videos' ? (
          <VideosTable videos={campaign.videos} />
        ) : tab === 'surveys' ? (
          <SurveysTable campaign={campaign} />
        ) : tab === 'transcripts' ? (
          <TranscriptsTable transcripts={campaign.transcripts} />
        ) : (
          <PlatformsTable campaign={campaign} />
        )}
      </section>

      {(campaign.warnings.length > 0 || campaign.errors.length > 0) && (
        <section className="space-y-2">
          <h2 className="text-lg font-semibold text-foreground">Notes</h2>
          {campaign.warnings.map((warning) => (
            <div
              key={warning}
              className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-200"
            >
              {warning}
            </div>
          ))}
          {campaign.errors.map((item) => (
            <div
              key={item}
              className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-200"
            >
              {item}
            </div>
          ))}
        </section>
      )}
    </div>
  );
}

function BackLink() {
  return (
    <Link
      to="/admin/campaigns-dashboard"
      className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground"
    >
      <ArrowLeft className="h-4 w-4" aria-hidden />
      Campaigns Dashboard
    </Link>
  );
}
