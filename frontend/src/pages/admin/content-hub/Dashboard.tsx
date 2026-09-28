import { Fragment, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  BarChart3,
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
} from 'lucide-react';
import {
  Button,
  ZoomAlert,
  ZoomEmptyState,
  ZoomLoadingState,
  ZoomStatusBadge,
} from '../../../components/admin/zoom-recordings/ZoomRecordingsUi';
import { Chip } from '../../../components/ui';
import { cn } from '../../../lib/cn';
import { useToast } from './components/Toaster';
import { useCampaigns, useDeleteCampaign, useHubspotStatus } from './lib/hooks';
import { formatDate } from './lib/utils';
import {
  PLATFORM_LABELS,
  STATUS_LABELS,
  type Campaign,
  type CampaignStatus,
} from './lib/types';

const CONTROL =
  'h-11 rounded-[6px] bg-card px-3 text-base text-foreground shadow-card outline-none placeholder:text-muted-foreground/70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring sm:text-sm';

const STATUS_TONE: Record<CampaignStatus, 'neutral' | 'warning' | 'info' | 'success'> = {
  draft: 'neutral',
  data_needed: 'warning',
  ready_for_review: 'info',
  final: 'success',
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

  const { data: campaigns, isLoading, isError, error } = useCampaigns();
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

  const removeCampaign = (campaign: Campaign) => {
    if (!window.confirm(`Delete "${campaign.name}"? This cannot be undone.`)) return;
    deleteMutation.mutate(campaign.id, {
      onSuccess: () => toast({ title: 'Campaign deleted', description: campaign.name }),
      onError: (err: Error) =>
        toast({ title: 'Failed to delete campaign', description: err.message, variant: 'destructive' }),
    });
  };

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 p-4 md:p-6">
      <header className="rounded-card bg-card p-5 shadow-card md:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <div className="grid size-11 shrink-0 place-items-center rounded-[6px] bg-muted text-brand-600">
              <FileText className="h-5 w-5" aria-hidden />
            </div>
            <div className="min-w-0">
              <h1 className="text-2xl font-semibold tracking-tight text-foreground">Campaign reports</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Link programs, generate executive PDFs and review campaign data.
              </p>
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <Button size="sm" variant="ghost" to="/admin/content-hub/integrations">
              <Settings className="h-4 w-4" />
              Integrations
            </Button>
            <Button size="sm" variant="ghost" to="/admin/content-hub/templates">
              <LayoutTemplate className="h-4 w-4" />
              Templates
            </Button>
            <Button size="sm" to="/admin/content-hub/new">
              <PlusCircle className="h-4 w-4" />
              New campaign
            </Button>
          </div>
        </div>
      </header>

      {hubspotStatus && !hubspotStatus.connected ? (
        <ZoomAlert tone="warning" title="HubSpot not connected">
          <span className="inline-flex flex-wrap items-center gap-2">
            <Link to="/admin/content-hub/integrations" className="font-medium underline underline-offset-2">
              Configure in Integrations
            </Link>
            <button
              type="button"
              aria-label="Refresh HubSpot status"
              className="inline-flex items-center gap-1 opacity-70 hover:opacity-100"
              onClick={() => refetchHubspotStatus()}
            >
              <RefreshCw className="h-3 w-3" aria-hidden />
              Recheck
            </button>
          </span>
        </ZoomAlert>
      ) : null}

      <section className="rounded-card bg-card p-4 shadow-card md:p-5" aria-label="Filter campaigns">
        <div className="grid gap-3 md:grid-cols-[1fr_auto_auto_auto]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <input
              type="search"
              aria-label="Search campaigns"
              className={cn(CONTROL, 'w-full pl-9')}
              placeholder="Search campaigns…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <select aria-label="Report type" className={CONTROL} value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
            <option value="">All types</option>
            <option value="analytics">Analytics</option>
            <option value="executive">Executive</option>
          </select>
          <select aria-label="Status" className={CONTROL} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">All statuses</option>
            <option value="draft">Draft</option>
            <option value="data_needed">Data needed</option>
            <option value="ready_for_review">Ready for review</option>
            <option value="final">Final</option>
          </select>
          <select aria-label="Platform" className={CONTROL} value={platformFilter} onChange={(e) => setPlatformFilter(e.target.value)}>
            <option value="">All platforms</option>
            <option value="linkedin">LinkedIn</option>
            <option value="meta">Meta</option>
            <option value="youtube">YouTube</option>
            <option value="livestream">Livestream</option>
            <option value="survey">Survey</option>
          </select>
        </div>
        <div className="mt-3 grid gap-3 md:grid-cols-[1fr_auto]">
          <div className="relative">
            <Building2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <input
              aria-label="Filter by client"
              className={cn(CONTROL, 'w-full pl-9')}
              placeholder="Filter by client…"
              value={clientFilter}
              onChange={(e) => setClientFilter(e.target.value)}
            />
          </div>
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <span>Period</span>
            <input aria-label="Period from" className={CONTROL} type="date" value={periodFrom} onChange={(e) => setPeriodFrom(e.target.value)} />
            <span>to</span>
            <input aria-label="Period to" className={CONTROL} type="date" value={periodTo} onChange={(e) => setPeriodTo(e.target.value)} />
          </div>
        </div>
      </section>

      {isLoading ? (
        <ZoomLoadingState label="Loading campaigns…" />
      ) : isError ? (
        <ZoomAlert tone="error">{error instanceof Error ? error.message : 'Failed to load campaigns.'}</ZoomAlert>
      ) : filteredCampaigns.length === 0 ? (
        <ZoomEmptyState
          icon={FileText}
          title={campaigns && campaigns.length > 0 ? 'No campaigns match these filters' : 'No campaigns yet'}
          body={
            campaigns && campaigns.length > 0
              ? 'Clear a filter to see more campaigns.'
              : 'Create a campaign to start linking programs and generating reports.'
          }
          action={
            campaigns && campaigns.length > 0 ? undefined : (
              <Button size="sm" to="/admin/content-hub/new">
                <PlusCircle className="h-4 w-4" />
                New campaign
              </Button>
            )
          }
        />
      ) : (
        <ul className="space-y-3">
          {filteredCampaigns.map((campaign) => (
            <CampaignCard
              key={campaign.id}
              campaign={campaign}
              onClientClick={(client) => setClientFilter(client)}
              onDelete={() => removeCampaign(campaign)}
            />
          ))}
        </ul>
      )}
    </div>
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
  const base = `/admin/content-hub/campaigns/${campaign.id}`;

  const metaItems: ReactNode[] = [];
  if (campaign.clientSponsor) {
    metaItems.push(
      <button
        key="client"
        type="button"
        className="inline-flex items-center gap-1 font-medium text-foreground transition-colors hover:text-brand-600"
        onClick={() => onClientClick(campaign.clientSponsor)}
      >
        <Building2 className="h-3.5 w-3.5" aria-hidden />
        {campaign.clientSponsor}
      </button>,
    );
  }
  if (campaign.programName) metaItems.push(<span key="program">{campaign.programName}</span>);
  if (campaign.diseaseState) metaItems.push(<span key="disease">{campaign.diseaseState}</span>);
  if (campaign.reportingPeriodStart || campaign.reportingPeriodEnd) {
    metaItems.push(
      <span key="period" className="inline-flex items-center gap-1">
        <Calendar className="h-3.5 w-3.5" aria-hidden />
        {formatDate(campaign.reportingPeriodStart)} – {formatDate(campaign.reportingPeriodEnd)}
      </span>,
    );
  }

  return (
    <li className="group rounded-card bg-card p-5 shadow-card transition-[box-shadow] duration-150 hover:shadow-card-hover">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              to={`${base}?tab=reports`}
              className="text-base font-semibold tracking-tight text-foreground transition-colors hover:text-brand-600"
            >
              {campaign.name}
            </Link>
            <ZoomStatusBadge tone={STATUS_TONE[campaign.status]}>{STATUS_LABELS[campaign.status]}</ZoomStatusBadge>
          </div>
          {metaItems.length > 0 ? (
            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              {metaItems.map((item, i) => (
                <Fragment key={i}>
                  {i > 0 && <span className="text-muted-foreground/40">·</span>}
                  {item}
                </Fragment>
              ))}
            </div>
          ) : null}
          {campaign.platforms.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {campaign.platforms.map((platform) => (
                <Chip key={platform}>{PLATFORM_LABELS[platform]}</Chip>
              ))}
            </div>
          ) : null}
          <p className="text-xs text-muted-foreground">
            Updated {formatDate(campaign.updatedAt)}
            {campaign.createdBy ? ` · ${campaign.createdBy}` : ''}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Button size="sm" variant="ghost" to={`${base}/upload`}>
            <Upload className="h-4 w-4" />
            Upload
          </Button>
          <Button size="sm" variant="outline" to={`${base}/report`}>
            <BarChart3 className="h-4 w-4" />
            Analytics
          </Button>
          <Button size="sm" to={`${base}?tab=reports`}>
            <FileText className="h-4 w-4" />
            Reports
            <ChevronRight className="h-4 w-4" />
          </Button>
          <button
            type="button"
            aria-label={`Delete ${campaign.name}`}
            className="grid size-9 place-items-center rounded-[6px] text-muted-foreground/60 transition-colors hover:bg-muted hover:text-destructive md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100"
            onClick={onDelete}
          >
            <Trash2 className="h-4 w-4" aria-hidden />
          </button>
        </div>
      </div>
    </li>
  );
}
