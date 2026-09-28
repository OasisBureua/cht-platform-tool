import { useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  BarChart3,
  CheckCircle2,
  ChevronRight,
  FileText,
  Loader2,
  RefreshCw,
  Tag,
  Upload,
  X,
  XCircle,
} from 'lucide-react';
import { getApiErrorMessage } from '../../../api/client';
import {
  Button,
  ZoomAlert,
  ZoomBackLink,
  ZoomLoadingState,
  ZoomSectionCard,
  ZoomStatusBadge,
} from '../../../components/admin/zoom-recordings/ZoomRecordingsUi';
import { Chip, SegmentedControl } from '../../../components/ui';
import { cn } from '../../../lib/cn';
import CampaignProgramsPanel from './components/CampaignProgramsPanel';
import ReportsPanel from './components/ReportsPanel';
import { useToast } from './components/Toaster';
import {
  useCampaign,
  useCsvData,
  useDataValidation,
  useHubspotSync,
  useUpdateCampaign,
} from './lib/hooks';
import { useCampaignLinkPrograms } from './lib/reportHooks';
import { formatDate } from './lib/utils';
import type { Campaign, DataValidation, Platform } from './lib/types';

type TabKey = 'reports' | 'programs' | 'sources' | 'validation' | 'settings';

const TABS: TabKey[] = ['reports', 'programs', 'sources', 'validation', 'settings'];

type ValidationResponse = DataValidation & {
  missingData?: string[];
  recommendations?: string[];
};

const INPUT_CLS =
  'h-11 w-full rounded-[6px] bg-card px-3 text-base text-foreground shadow-card outline-none placeholder:text-muted-foreground/70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring sm:text-sm';

const PLATFORM_ORDER: Platform[] = ['linkedin', 'meta', 'youtube', 'livestream', 'survey'];

function capFirst(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

type EditableField =
  | 'name' | 'programName' | 'clientSponsor' | 'diseaseState' | 'treatmentTopic'
  | 'reportingPeriodStart' | 'reportingPeriodEnd' | 'targetAudience' | 'targetRegions'
  | 'targetInstitutions' | 'physicianSpeakers';

const DETAIL_FIELDS: Array<{ label: string; field: EditableField; type?: 'date' }> = [
  { label: 'Report title', field: 'name' },
  { label: 'Program name', field: 'programName' },
  { label: 'Client / sponsor', field: 'clientSponsor' },
  { label: 'Disease state', field: 'diseaseState' },
  { label: 'Treatment topic', field: 'treatmentTopic' },
  { label: 'Reporting period start', field: 'reportingPeriodStart', type: 'date' },
  { label: 'Reporting period end', field: 'reportingPeriodEnd', type: 'date' },
  { label: 'Target audience', field: 'targetAudience' },
  { label: 'Target regions', field: 'targetRegions' },
  { label: 'Target institutions', field: 'targetInstitutions' },
  { label: 'Physician speakers', field: 'physicianSpeakers' },
];

function SourcesTab({
  id,
  campaign,
}: {
  id: string;
  campaign: Campaign | undefined;
}) {
  const { toast } = useToast();
  const { data: csvData } = useCsvData(id);
  const syncMutation = useHubspotSync(id);

  const doSync = () =>
    syncMutation.mutate(undefined, {
      onSuccess: (result) => {
        const notes = [
          ...(result.errors?.length ? [`Errors: ${result.errors.join('; ')}`] : []),
          ...(result.warnings?.length ? [`Notes: ${result.warnings.join('; ')}`] : []),
        ];
        toast({
          title: 'HubSpot synced',
          description: notes.length > 0 ? notes.join(' ') : 'Campaign analytics snapshot saved to Content Hub.',
        });
      },
      onError: (err: unknown) =>
        toast({
          title: 'HubSpot sync failed',
          description: getApiErrorMessage(err, 'HubSpot sync failed.'),
          variant: 'destructive',
        }),
    });

  return (
    <div className="space-y-6">
      <ZoomSectionCard
        title="HubSpot CRM"
        description="Contact, form and email data for this campaign."
        action={
          <Button size="sm" variant="outline" onClick={doSync} disabled={syncMutation.isPending}>
            <RefreshCw className={cn('h-3.5 w-3.5', syncMutation.isPending && 'animate-spin')} />
            Sync now
          </Button>
        }
      >
        {campaign?.hubspotSyncedAt ? (
          <ZoomStatusBadge tone="success" icon={CheckCircle2}>
            Synced {formatDate(campaign.hubspotSyncedAt)}
          </ZoomStatusBadge>
        ) : (
          <ZoomStatusBadge tone="neutral">Not synced yet</ZoomStatusBadge>
        )}
      </ZoomSectionCard>

      <ZoomSectionCard
        title="Platform CSV uploads"
        description="Channel exports that feed the report."
        action={
          <Button size="sm" variant="outline" to={`/admin/reports/campaigns/${id}/upload`}>
            <Upload className="h-3.5 w-3.5" />
            Upload CSV
          </Button>
        }
      >
        <ul className="-mx-5 -mb-5 divide-y divide-border md:-mx-6 md:-mb-6">
          {PLATFORM_ORDER.map((p) => {
            const upload = csvData?.find((u) => u.platform === p);
            return (
              <li key={p} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 md:px-6">
                <span className="text-sm font-medium text-foreground">{capFirst(p)}</span>
                {upload ? (
                  <span className="text-xs text-muted-foreground">
                    {upload.filename} · {upload.rowCount} rows · {formatDate(upload.uploadedAt)}
                  </span>
                ) : (
                  <ZoomStatusBadge tone="neutral">No data uploaded</ZoomStatusBadge>
                )}
              </li>
            );
          })}
        </ul>
      </ZoomSectionCard>
    </div>
  );
}

function ValidationTab({ id }: { id: string }) {
  const { data: validation, isLoading } = useDataValidation(id) as {
    data: ValidationResponse | undefined;
    isLoading: boolean;
  };

  if (isLoading) return <ZoomLoadingState label="Checking data sources…" />;

  return (
    <div className="space-y-4">
      {validation?.dataSourcesSummary.map((src) => (
        <ZoomSectionCard
          key={src.source}
          title={src.source}
          action={
            src.status === 'available' ? (
              <ZoomStatusBadge tone="success" icon={CheckCircle2}>Ready</ZoomStatusBadge>
            ) : (
              <ZoomStatusBadge tone="warning" icon={XCircle}>Missing</ZoomStatusBadge>
            )
          }
        >
          <div className="grid gap-4 text-sm sm:grid-cols-2">
            {src.metricsAvailable.length > 0 && (
              <div>
                <p className="mb-1.5 font-medium text-foreground">Available</p>
                <ul className="space-y-1 text-muted-foreground">
                  {src.metricsAvailable.map((m) => (
                    <li key={m} className="flex items-center gap-2">
                      <span className="size-1.5 rounded-full bg-green-600" aria-hidden />
                      {m}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {src.metricsMissing.length > 0 && (
              <div>
                <p className="mb-1.5 font-medium text-foreground">Missing</p>
                <ul className="space-y-1 text-muted-foreground">
                  {src.metricsMissing.map((m) => (
                    <li key={m} className="flex items-center gap-2">
                      <span className="size-1.5 rounded-full bg-amber-500" aria-hidden />
                      {m}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </ZoomSectionCard>
      ))}

      {validation?.recommendations && validation.recommendations.length > 0 && (
        <ZoomSectionCard title="Recommendations">
          <ul className="space-y-2">
            {validation.recommendations.map((rec) => (
              <li key={rec} className="flex items-start gap-2 text-sm text-muted-foreground">
                <ChevronRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-600" aria-hidden />
                {rec}
              </li>
            ))}
          </ul>
        </ZoomSectionCard>
      )}
    </div>
  );
}

function SettingsTab({ id, campaign }: { id: string; campaign: Campaign | undefined }) {
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Record<EditableField, string>>(
    () => Object.fromEntries(DETAIL_FIELDS.map(({ field }) => [field, ''])) as Record<EditableField, string>,
  );
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const saveMutation = useUpdateCampaign(id);
  const tagsMutation = useUpdateCampaign(id);

  const [tagsFrom, setTagsFrom] = useState<typeof campaign>(undefined);
  if (campaign !== tagsFrom) {
    setTagsFrom(campaign);
    if (campaign) setTags(campaign.tags ?? []);
  }

  const startEditing = () => {
    if (!campaign) return;
    setForm(
      Object.fromEntries(
        DETAIL_FIELDS.map(({ field }) => [field, (campaign[field] as string | null) ?? '']),
      ) as Record<EditableField, string>,
    );
    setEditing(true);
  };

  const handleSave = () => {
    if (!campaign) return;
    const changed: Partial<Campaign> = {};
    for (const { field } of DETAIL_FIELDS) {
      if (form[field] !== (campaign[field] ?? '')) {
        (changed as Record<string, string>)[field] = form[field];
      }
    }
    if (Object.keys(changed).length === 0) {
      setEditing(false);
      return;
    }
    saveMutation.mutate(changed, {
      onSuccess: () => {
        toast({ title: 'Saved' });
        setEditing(false);
      },
      onError: (err: Error) => toast({ title: 'Save failed', description: err.message, variant: 'destructive' }),
    });
  };

  const persistTags = (next: string[]) =>
    tagsMutation.mutate(
      { tags: next },
      { onError: (err: Error) => toast({ title: 'Failed to update tags', description: err.message, variant: 'destructive' }) },
    );

  const confirmTag = () => {
    const value = tagInput.trim().replace(/,+$/, '').trim();
    setTagInput('');
    if (!value || tags.includes(value)) return;
    const next = [...tags, value];
    setTags(next);
    persistTags(next);
  };

  const removeTag = (tag: string) => {
    const next = tags.filter((t) => t !== tag);
    setTags(next);
    persistTags(next);
  };

  return (
    <div className="space-y-6">
      <ZoomSectionCard
        title="Tags"
        description="Group campaigns across clients. Press Enter or comma to add a tag."
        action={<Tag className="h-4 w-4 text-brand-600" aria-hidden />}
      >
        <div className="flex min-h-11 flex-wrap items-center gap-2 rounded-[6px] bg-card p-2 shadow-card focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-ring">
          {tags.map((tag) => (
            <span key={tag} className="inline-flex h-7 items-center gap-1 rounded-[6px] bg-muted px-2.5 text-xs font-medium text-foreground">
              {tag}
              <button aria-label={`Remove ${tag}`} onClick={() => removeTag(tag)} className="text-muted-foreground hover:text-foreground">
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
          <input
            aria-label="Add a tag"
            placeholder="Type a tag and press Enter…"
            className="min-w-24 flex-1 bg-transparent px-1 text-sm text-foreground outline-none placeholder:text-muted-foreground/70"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ',') {
                e.preventDefault();
                confirmTag();
              }
            }}
            onBlur={() => {
              if (tagInput.trim()) confirmTag();
            }}
          />
        </div>
      </ZoomSectionCard>

      <ZoomSectionCard
        title="Campaign details"
        action={
          editing ? (
            <div className="flex gap-2">
              <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>
              <Button size="sm" onClick={handleSave} disabled={saveMutation.isPending}>
                {saveMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                Save
              </Button>
            </div>
          ) : (
            <Button size="sm" variant="outline" onClick={startEditing}>Edit</Button>
          )
        }
      >
        <dl className="divide-y divide-border text-sm">
          {DETAIL_FIELDS.map(({ label, field, type }) => (
            <div key={field} className="grid gap-1 py-3 sm:grid-cols-[12rem_1fr] sm:items-center sm:gap-4">
              <dt className="text-muted-foreground">
                {editing ? <label htmlFor={`field-${field}`}>{label}</label> : label}
              </dt>
              <dd className="min-w-0 text-foreground">
                {editing ? (
                  <input
                    id={`field-${field}`}
                    type={type ?? 'text'}
                    className={INPUT_CLS}
                    value={form[field]}
                    onChange={(e) => setForm((prev) => ({ ...prev, [field]: e.target.value }))}
                  />
                ) : (
                  <span className="break-words">{(campaign?.[field] as string | undefined) || '—'}</span>
                )}
              </dd>
            </div>
          ))}
          <div className="grid gap-1 py-3 sm:grid-cols-[12rem_1fr] sm:gap-4">
            <dt className="text-muted-foreground">Hub campaign ID</dt>
            <dd className="font-mono text-foreground">{campaign?.id ?? '—'}</dd>
          </div>
          <div className="grid gap-1 py-3 sm:grid-cols-[12rem_1fr] sm:gap-4">
            <dt className="text-muted-foreground">Created by</dt>
            <dd className="text-foreground">{campaign?.createdBy || '—'}</dd>
          </div>
          <div className="grid gap-1 py-3 sm:grid-cols-[12rem_1fr] sm:gap-4">
            <dt className="text-muted-foreground">Status</dt>
            <dd className="text-foreground">{campaign?.status ?? '—'}</dd>
          </div>
        </dl>
      </ZoomSectionCard>
    </div>
  );
}

export default function CampaignDetail() {
  const { id = '' } = useParams<{ id: string }>();
  const [params, setParams] = useSearchParams();
  const requested = params.get('tab') as TabKey | null;
  const tab: TabKey = requested && TABS.includes(requested) ? requested : 'reports';
  const setTab = (next: TabKey) =>
    setParams(
      (prev) => {
        const out = new URLSearchParams(prev);
        out.set('tab', next);
        return out;
      },
      { replace: true },
    );

  const { data: campaign, isLoading, isError, error } = useCampaign(id);
  const { data: programs } = useCampaignLinkPrograms();
  const linkedCount = useMemo(
    () => (programs ?? []).filter((p) => p.campaignId === id).length,
    [programs, id],
  );

  const segments = [
    { value: 'reports' as const, label: 'Reports' },
    { value: 'programs' as const, label: 'Programs', count: linkedCount },
    { value: 'sources' as const, label: 'Data sources' },
    { value: 'validation' as const, label: 'Validation' },
    { value: 'settings' as const, label: 'Settings' },
  ];

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 p-4 md:p-6">
      <ZoomBackLink to="/admin/reports">
        <ArrowLeft className="h-4 w-4" aria-hidden />
        All campaigns
      </ZoomBackLink>

      {isError ? (
        <ZoomAlert tone="error">{getApiErrorMessage(error, 'Campaign not found.')}</ZoomAlert>
      ) : null}

      <header className="rounded-card bg-card p-5 shadow-card md:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <div className="grid size-11 shrink-0 place-items-center rounded-[6px] bg-muted text-brand-600">
              <FileText className="h-5 w-5" aria-hidden />
            </div>
            <div className="min-w-0 space-y-2">
              <h1 className="text-2xl font-semibold tracking-tight text-foreground">
                {isLoading ? 'Loading campaign…' : campaign?.name || 'Campaign'}
              </h1>
              <p className="text-sm text-muted-foreground">
                {[campaign?.programName, campaign?.clientSponsor].filter(Boolean).join(' · ') || '—'}
                {campaign?.reportingPeriodStart ? (
                  <>
                    {' · '}
                    {formatDate(campaign.reportingPeriodStart)} – {formatDate(campaign.reportingPeriodEnd)}
                  </>
                ) : null}
              </p>
              {campaign?.platforms?.length ? (
                <div className="flex flex-wrap gap-1.5">
                  {campaign.platforms.map((p) => (
                    <Chip key={p}>{capFirst(p)}</Chip>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <Button size="sm" variant="outline" to={`/admin/reports/campaigns/${id}/upload`}>
              <Upload className="h-4 w-4" />
              Upload CSV
            </Button>
            <Button size="sm" variant="outline" to={`/admin/reports/campaigns/${id}/report`}>
              <BarChart3 className="h-4 w-4" />
              Analytics report
            </Button>
          </div>
        </div>
      </header>

      <div className="overflow-x-auto">
        <SegmentedControl
          label="Campaign sections"
          segments={segments}
          value={tab}
          onChange={setTab}
          panelId={(v) => `campaign-panel-${v}`}
        />
      </div>

      <div id={`campaign-panel-${tab}`} role="tabpanel">
        {tab === 'reports' && (
          <ReportsPanel
            campaignId={id}
            linkedProgramCount={linkedCount}
            onGoToPrograms={() => setTab('programs')}
          />
        )}
        {tab === 'programs' && <CampaignProgramsPanel campaignId={id} campaignName={campaign?.name} />}
        {tab === 'sources' && <SourcesTab id={id} campaign={campaign} />}
        {tab === 'validation' && <ValidationTab id={id} />}
        {tab === 'settings' && <SettingsTab id={id} campaign={campaign} />}
      </div>
    </div>
  );
}
