import { Fragment, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Building2,
  Calendar,
  ChevronRight,
  FileText,
  LayoutTemplate,
  PlusCircle,
  RefreshCw,
  Search,
  Settings,
  Trash2,
  Upload,
  WifiOff,
} from 'lucide-react';
import ChromeContainer from './components/ChromeContainer';
import { useToast } from './components/Toaster';
import { useCampaigns, useDeleteCampaign, useHubspotStatus } from './lib/hooks';
import { cn, formatDate } from './lib/utils';
import {
  PLATFORM_COLORS,
  PLATFORM_LABELS,
  STATUS_LABELS,
  type Campaign,
  type CampaignStatus,
} from './lib/types';

const headerOutlineBtn =
  'inline-flex h-8 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border border-border px-3 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground hover:bg-muted disabled:pointer-events-none disabled:opacity-50';

const newReportBtn =
  'inline-flex h-8 items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-primary bg-primary px-4 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary-hover';

const solidReportBtn =
  'inline-flex h-8 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border border-primary bg-primary px-3 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary-hover';

const outlineReportBtn =
  'inline-flex h-8 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border border-primary/40 px-3 text-xs font-medium text-primary transition-colors hover:border-primary hover:bg-primary/10';

const chevronBtn =
  'inline-flex h-8 w-8 items-center justify-center rounded-lg border border-primary bg-primary text-primary-foreground transition-colors hover:bg-primary-hover';

const textInput =
  'flex h-8 w-full rounded-lg border border-border bg-background pl-9 pr-3 py-1 text-sm text-foreground shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary';

const selectInput =
  'h-8 rounded-lg border border-border bg-background px-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary';

const STATUS_PILL_CLASSES: Record<CampaignStatus, string> = {
  draft: 'bg-muted text-muted-foreground',
  data_needed: 'bg-accent/15 text-accent',
  ready_for_review: 'bg-primary/15 text-primary',
  final: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
};

export default function Dashboard() {
  const [searchParams] = useSearchParams();
  const clientParam = searchParams.get('client') ?? '';

  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [platformFilter, setPlatformFilter] = useState('');
  const [clientFilter, setClientFilter] = useState(clientParam);
  const [periodFrom, setPeriodFrom] = useState('');
  const [periodTo, setPeriodTo] = useState('');

  const { toast } = useToast();

  useEffect(() => {
    setClientFilter(clientParam);
  }, [clientParam]);

  const { data: campaigns } = useCampaigns();
  const { data: hubspotStatus, refetch: refetchHubspotStatus } = useHubspotStatus();
  const deleteMutation = useDeleteCampaign();

  const filteredCampaigns = useMemo(() => {
    if (!campaigns) return [];
    const q = searchQuery.trim().toLowerCase();
    const clientQ = clientFilter.trim().toLowerCase();
    return campaigns.filter((c) => {
      if (q) {
        const haystack = [c.name, c.programName, c.clientSponsor, c.diseaseState]
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      if (typeFilter && c.reportType !== typeFilter) return false;
      if (statusFilter && c.status !== statusFilter) return false;
      if (platformFilter && !c.platforms.includes(platformFilter as Campaign['platforms'][number]))
        return false;
      if (clientQ && !c.clientSponsor.toLowerCase().includes(clientQ)) return false;
      if (periodFrom && (!c.reportingPeriodStart || c.reportingPeriodStart < periodFrom)) return false;
      if (periodTo && (!c.reportingPeriodEnd || c.reportingPeriodEnd > periodTo)) return false;
      return true;
    });
  }, [campaigns, searchQuery, typeFilter, statusFilter, platformFilter, clientFilter, periodFrom, periodTo]);

  const removeCampaign = (campaign: Campaign) =>
    deleteMutation.mutate(campaign.id, {
      onSuccess: () => toast({ title: 'Report deleted', description: campaign.name }),
      onError: (err: Error) =>
        toast({ title: 'Failed to delete report', description: err.message, variant: 'destructive' }),
    });

  return (
    <ChromeContainer>
      <div className="mb-5 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Campaign Reports</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Create, manage, and export client-ready campaign performance reports.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/admin/content-hub/integrations" className={headerOutlineBtn}>
            <Settings className="h-3.5 w-3.5" aria-hidden="true" />
            Integrations
          </Link>
          <Link to="/admin/content-hub/templates" className={headerOutlineBtn}>
            <LayoutTemplate className="h-3.5 w-3.5" aria-hidden="true" />
            Templates
          </Link>
          <Link to="/admin/content-hub/new" className={newReportBtn}>
            <PlusCircle className="h-4 w-4" aria-hidden="true" />
            New Report
          </Link>
        </div>
      </div>

      {hubspotStatus && !hubspotStatus.connected && (
        <div className="mb-4 flex items-center gap-3 rounded-lg border border-accent/25 bg-accent/[0.08] px-4 py-2.5 text-xs text-accent">
          <WifiOff className="h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
          HubSpot not connected
          <Link
            to="/admin/content-hub/integrations"
            className="ml-0.5 cursor-pointer underline underline-offset-2 hover:opacity-80"
          >
            Configure in Integrations
          </Link>
          <button
            aria-label="Refresh HubSpot status"
            className="ml-auto opacity-60 hover:opacity-100"
            onClick={() => refetchHubspotStatus()}
          >
            <RefreshCw className="h-3 w-3" aria-hidden="true" />
          </button>
        </div>
      )}

      <div className="mb-2 flex flex-wrap items-center gap-2">
        <div className="relative min-w-44 flex-1">
          <Search
            className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <input
            className={textInput}
            placeholder="Search campaigns..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <select className={selectInput} value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
          <option value="">All Types</option>
          <option value="analytics">Analytics Report</option>
          <option value="executive">Executive Deck</option>
        </select>
        <select className={selectInput} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">All Statuses</option>
          <option value="draft">Draft</option>
          <option value="data_needed">Data Needed</option>
          <option value="ready_for_review">Ready for Review</option>
          <option value="final">Final</option>
        </select>
        <select
          className={selectInput}
          value={platformFilter}
          onChange={(e) => setPlatformFilter(e.target.value)}
        >
          <option value="">All Platforms</option>
          <option value="linkedin">LinkedIn</option>
          <option value="meta">Meta</option>
          <option value="youtube">YouTube</option>
          <option value="livestream">Livestream</option>
          <option value="survey">Survey</option>
        </select>
      </div>

      <div className="mb-5 flex flex-wrap items-center gap-2">
        <div className="relative min-w-44">
          <Building2
            className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <input
            className={textInput}
            placeholder="Filter by client..."
            value={clientFilter}
            onChange={(e) => setClientFilter(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-1.5">
          <span className="flex-shrink-0 text-[10px] uppercase tracking-wide text-muted-foreground">
            Period from
          </span>
          <input
            className={selectInput}
            type="date"
            value={periodFrom}
            onChange={(e) => setPeriodFrom(e.target.value)}
          />
          <span className="text-[10px] text-muted-foreground">to</span>
          <input
            className={selectInput}
            type="date"
            value={periodTo}
            onChange={(e) => setPeriodTo(e.target.value)}
          />
        </div>
      </div>

      <div className="space-y-3">
        {filteredCampaigns.map((campaign) => (
          <CampaignCard
            key={campaign.id}
            campaign={campaign}
            onClientClick={(client) => setClientFilter(client)}
            onDelete={() => removeCampaign(campaign)}
          />
        ))}
      </div>
    </ChromeContainer>
  );
}

function CampaignCard({
  campaign,
  onClientClick,
  onDelete,
}: {
  campaign: Campaign;
  onClientClick: (client: string) => void;
  onDelete: () => void;
}) {
  const isAnalytics = campaign.reportType === 'analytics';

  const metaItems: ReactNode[] = [];
  if (campaign.clientSponsor) {
    metaItems.push(
      <button
        key="client"
        className="flex items-center gap-1 font-medium text-foreground transition-colors hover:text-primary"
        onClick={() => onClientClick(campaign.clientSponsor)}
      >
        <Building2 className="h-3 w-3" aria-hidden="true" />
        {campaign.clientSponsor}
      </button>,
    );
  }
  if (campaign.programName) metaItems.push(<span key="program">{campaign.programName}</span>);
  if (campaign.diseaseState) metaItems.push(<span key="disease">{campaign.diseaseState}</span>);
  if (campaign.reportingPeriodStart || campaign.reportingPeriodEnd) {
    metaItems.push(
      <span key="period" className="flex items-center gap-1">
        <Calendar className="h-3 w-3" aria-hidden="true" />
        {campaign.reportingPeriodStart}: {campaign.reportingPeriodEnd}
      </span>,
    );
  }

  return (
    <div className="group rounded-xl border border-border bg-card transition-all hover:border-primary/50 hover:shadow-sm">
      <div className="flex items-start gap-4 px-5 pb-4 pt-5">
        <div
          className={cn('w-1 flex-shrink-0 self-stretch rounded-full', isAnalytics ? 'bg-primary' : 'bg-foreground/60')}
        />
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <Link to={`/admin/content-hub/campaigns/${campaign.id}`}>
              <span className="cursor-pointer text-[15px] font-semibold text-foreground">{campaign.name}</span>
            </Link>
            <span
              className={cn(
                'rounded-full px-2 py-0.5 text-[10px] font-semibold',
                isAnalytics ? 'bg-primary/15 text-primary' : 'bg-foreground/10 text-foreground',
              )}
            >
              {isAnalytics ? 'Analytics' : 'Executive Deck'}
            </span>
            <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-semibold', STATUS_PILL_CLASSES[campaign.status])}>
              {STATUS_LABELS[campaign.status]}
            </span>
          </div>
          <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            {metaItems.map((item, i) => (
              <Fragment key={i}>
                {i > 0 && <span className="text-muted-foreground/40">·</span>}
                {item}
              </Fragment>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {campaign.platforms.map((platform) => (
              <span
                key={platform}
                className="rounded px-1.5 py-0.5 text-[10px] font-medium text-white"
                style={{ backgroundColor: PLATFORM_COLORS[platform] }}
              >
                {PLATFORM_LABELS[platform]}
              </span>
            ))}
          </div>
          <div className="mt-1.5 text-[10px] text-muted-foreground/70">
            Updated {formatDate(campaign.updatedAt)}
            {campaign.createdBy ? ` · ${campaign.createdBy}` : ''}
          </div>
        </div>
        <div className="flex flex-shrink-0 items-center gap-2 pt-0.5">
          <Link to={`/admin/content-hub/campaigns/${campaign.id}/upload`} className={headerOutlineBtn}>
            <Upload className="h-3 w-3" aria-hidden="true" />
            Upload
          </Link>
          <Link
            to={`/admin/content-hub/campaigns/${campaign.id}/report`}
            className={isAnalytics ? solidReportBtn : outlineReportBtn}
          >
            <FileText className="h-3 w-3" aria-hidden="true" />
            Analytics
          </Link>
          <Link
            to={`/admin/content-hub/campaigns/${campaign.id}/executive-report`}
            className={isAnalytics ? outlineReportBtn : solidReportBtn}
          >
            <FileText className="h-3 w-3" aria-hidden="true" />
            Exec Deck
          </Link>
          <Link to={`/admin/content-hub/campaigns/${campaign.id}`} className={chevronBtn} aria-label="Open campaign">
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </Link>
          <button
            aria-label="Delete report"
            className="p-1.5 text-muted-foreground/40 opacity-0 transition-colors hover:text-accent group-hover:opacity-100"
            onClick={onDelete}
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
}
