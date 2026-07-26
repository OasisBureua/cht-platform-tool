import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  FileText,
  RefreshCw,
  Tag,
  Upload,
  X,
  XCircle,
} from 'lucide-react';
import ChromeContainer from './components/ChromeContainer';
import { useToast } from './components/Toaster';
import {
  useCampaign,
  useCsvData,
  useDataValidation,
  useHubspotSync,
  useUpdateCampaign,
} from './lib/hooks';
import { cn, formatDate } from './lib/utils';
import type { Campaign, DataValidation, Platform } from './lib/types';
import { PLATFORM_COLORS } from './lib/types';

type TabKey = 'sources' | 'validation' | 'settings';

type ValidationResponse = DataValidation & {
  missingData?: string[];
  recommendations?: string[];
};

const OUTLINE_BTN =
  'inline-flex min-h-8 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border border-border px-3 text-xs font-medium transition-colors hover:bg-muted disabled:pointer-events-none disabled:opacity-50';

const SOLID_BTN =
  'inline-flex min-h-8 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border border-foreground/80 bg-foreground px-3 text-xs font-medium text-background transition-colors hover:bg-foreground/90';

const PRIMARY_BTN =
  'inline-flex h-9 min-h-9 items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-primary bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary-hover disabled:pointer-events-none disabled:opacity-50';

const INPUT_CLS =
  'flex h-9 w-full rounded-lg border border-border bg-background px-3 py-1 text-sm text-foreground shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary';

const PLATFORM_ORDER: Platform[] = ['linkedin', 'meta', 'youtube', 'livestream', 'survey'];

function capFirst(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

type EditableField =
  | 'name' | 'programName' | 'clientSponsor' | 'diseaseState' | 'treatmentTopic'
  | 'reportingPeriodStart' | 'reportingPeriodEnd' | 'targetAudience' | 'targetRegions'
  | 'targetInstitutions' | 'physicianSpeakers';

const DETAIL_FIELDS: Array<{ label: string; field: EditableField; type?: 'date' }> = [
  { label: 'Report Title', field: 'name' },
  { label: 'Program Name', field: 'programName' },
  { label: 'Client / Sponsor', field: 'clientSponsor' },
  { label: 'Disease State', field: 'diseaseState' },
  { label: 'Treatment Topic', field: 'treatmentTopic' },
  { label: 'Reporting Period Start', field: 'reportingPeriodStart', type: 'date' },
  { label: 'Reporting Period End', field: 'reportingPeriodEnd', type: 'date' },
  { label: 'Target Audience', field: 'targetAudience' },
  { label: 'Target Regions', field: 'targetRegions' },
  { label: 'Target Institutions', field: 'targetInstitutions' },
  { label: 'Physician Speakers', field: 'physicianSpeakers' },
];

export default function CampaignDetail() {
  const { id = '' } = useParams<{ id: string }>();
  const { toast } = useToast();
  const [tab, setTab] = useState<TabKey>('sources');
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Record<EditableField, string>>({
    name: '', programName: '', clientSponsor: '', diseaseState: '', treatmentTopic: '',
    reportingPeriodStart: '', reportingPeriodEnd: '', targetAudience: '', targetRegions: '',
    targetInstitutions: '', physicianSpeakers: '',
  });
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');

  const { data: campaign } = useCampaign(id);
  const { data: csvData } = useCsvData(id);
  const { data: validation } = useDataValidation(id) as { data: ValidationResponse | undefined };

  const syncMutation = useHubspotSync(id);
  const saveMutation = useUpdateCampaign(id);
  const tagsMutation = useUpdateCampaign(id);

  useEffect(() => {
    if (campaign) setTags(campaign.tags ?? []);
  }, [campaign]);

  const doSync = () =>
    syncMutation.mutate(undefined, {
      onSuccess: () => toast({ title: 'HubSpot synced', description: 'Contact, form, and email data pulled.' }),
      onError: (err: Error) => toast({ title: 'HubSpot sync failed', description: err.message, variant: 'destructive' }),
    });

  const startEditing = () => {
    if (!campaign) return;
    setForm({
      name: campaign.name ?? '',
      programName: campaign.programName ?? '',
      clientSponsor: campaign.clientSponsor ?? '',
      diseaseState: campaign.diseaseState ?? '',
      treatmentTopic: campaign.treatmentTopic ?? '',
      reportingPeriodStart: campaign.reportingPeriodStart ?? '',
      reportingPeriodEnd: campaign.reportingPeriodEnd ?? '',
      targetAudience: campaign.targetAudience ?? '',
      targetRegions: campaign.targetRegions ?? '',
      targetInstitutions: campaign.targetInstitutions ?? '',
      physicianSpeakers: campaign.physicianSpeakers ?? '',
    });
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
      toast({ title: 'Saved' });
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
    <ChromeContainer>
      <div className="-m-6 flex min-h-full flex-col">
        <div className="border-b border-border bg-card px-8 py-5">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3">
              <Link to="/admin/content-hub" className="mt-0.5 text-muted-foreground hover:text-foreground" aria-label="Back to reports">
                <ArrowLeft className="h-5 w-5" />
              </Link>
              <div>
                <h1 className="text-xl font-bold text-foreground">{campaign?.name}</h1>
                <div className="mt-1 flex flex-wrap items-center gap-3">
                  {campaign?.programName && <span className="text-sm text-muted-foreground">{campaign.programName}</span>}
                  {campaign?.clientSponsor && <span className="text-sm text-muted-foreground">, {campaign.clientSponsor}</span>}
                  {campaign?.platforms.map((p) => (
                    <span key={p} className="rounded px-1.5 py-0.5 text-[10px] font-medium text-white" style={{ backgroundColor: PLATFORM_COLORS[p] }}>
                      {capFirst(p)}
                    </span>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Link to={`/admin/content-hub/campaigns/${id}/upload`} className={cn(OUTLINE_BTN, 'text-muted-foreground')}>
                <Upload className="h-3.5 w-3.5" />
                Upload CSV
              </Link>
              <Link to={`/admin/content-hub/campaigns/${id}/report`} className={cn(OUTLINE_BTN, 'border-primary/40 text-primary hover:border-primary')}>
                <FileText className="h-3.5 w-3.5" />
                Analytics Report
              </Link>
              <Link to={`/admin/content-hub/campaigns/${id}/executive-report`} className={SOLID_BTN}>
                <FileText className="h-3.5 w-3.5" />
                Executive Deck
              </Link>
            </div>
          </div>
          <div className="-mb-5 mt-4 flex gap-0 overflow-x-auto border-b border-border">
            {(
              [
                ['sources', 'Data Sources'],
                ['validation', 'Validation'],
                ['settings', 'Settings'],
              ] as Array<[TabKey, string]>
            ).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={cn(
                  'border-b-2 px-4 py-2.5 text-sm font-medium transition-colors',
                  tab === key ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground',
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-auto p-8">
          {tab === 'sources' && (
            <div className="max-w-3xl space-y-6">
              <div className="rounded-xl border border-border bg-card">
                <div className="flex items-center justify-between border-b border-border px-5 py-4">
                  <div className="flex items-center gap-2">
                    <div className={cn('h-2 w-2 rounded-full', campaign?.hubspotSyncedAt ? 'bg-emerald-500' : 'bg-muted-foreground/30')} />
                    <span className="text-sm font-semibold text-foreground">HubSpot CRM</span>
                  </div>
                  <button className={cn(OUTLINE_BTN, 'border-primary/40 text-primary')} onClick={doSync} disabled={syncMutation.isPending}>
                    <RefreshCw className={cn('h-3.5 w-3.5', syncMutation.isPending && 'animate-spin')} />
                    Sync Now
                  </button>
                </div>
                <div className="px-5 py-4 text-sm text-muted-foreground">
                  Connect HubSpot by adding HUBSPOT_ACCESS_TOKEN to your environment secrets, then sync to pull contact,
                  form, and email data.
                </div>
              </div>

              <div className="rounded-xl border border-border bg-card">
                <div className="flex items-center justify-between border-b border-border px-5 py-4">
                  <span className="text-sm font-semibold text-foreground">Platform CSV Uploads</span>
                  <Link to={`/admin/content-hub/campaigns/${id}/upload`} className={cn(OUTLINE_BTN, 'text-primary')}>
                    <Upload className="h-3.5 w-3.5" />
                    Upload CSV
                  </Link>
                </div>
                <div className="divide-y divide-border">
                  {PLATFORM_ORDER.map((p) => {
                    const upload = csvData?.find((u) => u.platform === p);
                    return (
                      <div key={p} className="flex items-center gap-3 px-5 py-3">
                        <div className={cn('h-2 w-2 rounded-full', upload ? 'bg-emerald-500' : 'bg-muted-foreground/20')} />
                        <span className="w-24 text-sm font-medium text-foreground">{capFirst(p)}</span>
                        {upload ? (
                          <span className="text-xs text-muted-foreground">
                            {upload.filename} · {upload.rowCount} rows · {formatDate(upload.uploadedAt)}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">No data uploaded</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {tab === 'validation' && (
            <div className="max-w-3xl space-y-4">
              {validation?.dataSourcesSummary.map((src) => (
                <div key={src.source} className="rounded-xl border border-border bg-card">
                  <div className="flex items-center gap-3 border-b border-border px-5 py-4">
                    {src.status === 'available' ? (
                      <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-emerald-500" />
                    ) : (
                      <XCircle className="h-4 w-4 flex-shrink-0 text-accent" />
                    )}
                    <span className="text-sm font-semibold text-foreground">{src.source}</span>
                    {src.status === 'available' ? (
                      <span className="ml-auto rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">Ready</span>
                    ) : (
                      <span className="ml-auto rounded-full bg-accent/15 px-2 py-0.5 text-xs font-medium text-accent">Missing</span>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-4 px-5 py-4 text-xs">
                    {src.metricsAvailable.length > 0 && (
                      <div>
                        <p className="mb-1.5 font-medium text-foreground">Available</p>
                        <ul className="space-y-0.5">
                          {src.metricsAvailable.map((m) => (
                            <li key={m} className="flex items-center gap-1 text-foreground">
                              <span className="inline-block h-1 w-1 rounded-full bg-emerald-500" />
                              {m}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {src.metricsMissing.length > 0 && (
                      <div>
                        <p className="mb-1.5 font-medium text-foreground">Missing</p>
                        <ul className="space-y-0.5">
                          {src.metricsMissing.map((m) => (
                            <li key={m} className="flex items-center gap-1 text-accent">
                              <span className="inline-block h-1 w-1 rounded-full bg-accent" />
                              {m}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {validation?.recommendations && validation.recommendations.length > 0 && (
                <div className="rounded-xl border border-accent/30 bg-accent/10 px-5 py-4">
                  <p className="mb-2 text-sm font-semibold text-foreground">Recommendations</p>
                  <ul className="space-y-1.5">
                    {validation.recommendations.map((rec) => (
                      <li key={rec} className="flex items-start gap-2 text-sm text-muted-foreground">
                        <ChevronRight className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-accent" />
                        {rec}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {tab === 'settings' && (
            <div className="max-w-2xl space-y-5">
              <div className="rounded-xl border border-border bg-card p-6">
                <div className="mb-4 flex items-center gap-2">
                  <Tag className="h-4 w-4 text-primary" />
                  <h2 className="font-semibold text-foreground">Tags</h2>
                </div>
                <p className="mb-3 text-xs text-muted-foreground">
                  Add tags to group campaigns across clients. Press Enter or comma to confirm a tag.
                </p>
                <div className="flex min-h-[42px] cursor-text flex-wrap gap-1.5 rounded-lg border border-border bg-background p-2.5 focus-within:ring-2 focus-within:ring-primary">
                  {tags.map((tag) => (
                    <span key={tag} className="inline-flex items-center gap-1 rounded bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                      {tag}
                      <button aria-label={`Remove ${tag}`} onClick={() => removeTag(tag)} className="text-primary/60 hover:text-primary">
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                  <input
                    placeholder="Type a tag and press Enter..."
                    className="min-w-24 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground/60"
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
              </div>

              <div className="rounded-xl border border-border bg-card p-6">
                <div className="mb-5 flex items-center justify-between">
                  <h2 className="font-semibold text-foreground">Campaign Details</h2>
                  {editing ? (
                    <div className="flex items-center gap-2">
                      <button className={OUTLINE_BTN} onClick={() => setEditing(false)}>Cancel</button>
                      <button className={PRIMARY_BTN} onClick={handleSave} disabled={saveMutation.isPending}>Save</button>
                    </div>
                  ) : (
                    <button className={OUTLINE_BTN} onClick={startEditing}>Edit</button>
                  )}
                </div>
                <dl className="space-y-4 text-sm">
                  {DETAIL_FIELDS.map(({ label, field, type }) => (
                    <div key={field} className="flex gap-4">
                      <dt className="w-48 flex-shrink-0 text-muted-foreground">{label}</dt>
                      {editing ? (
                        <dd className="flex-1 text-foreground">
                          <input
                            type={type ?? 'text'}
                            className={INPUT_CLS}
                            value={form[field]}
                            onChange={(e) => setForm((prev) => ({ ...prev, [field]: e.target.value }))}
                          />
                        </dd>
                      ) : (
                        <dd className="flex-1 break-all text-foreground">{campaign?.[field]}</dd>
                      )}
                    </div>
                  ))}
                  <div className="flex gap-4">
                    <dt className="w-48 flex-shrink-0 text-muted-foreground">Created By</dt>
                    <dd className="flex-1 break-all text-foreground">{campaign?.createdBy}</dd>
                  </div>
                  <div className="flex gap-4">
                    <dt className="w-48 flex-shrink-0 text-muted-foreground">Report Type</dt>
                    <dd className="flex-1 break-all text-foreground">{campaign?.reportType}</dd>
                  </div>
                  <div className="flex gap-4">
                    <dt className="w-48 flex-shrink-0 text-muted-foreground">Status</dt>
                    <dd className="flex-1 break-all text-foreground">{campaign?.status}</dd>
                  </div>
                </dl>
              </div>
            </div>
          )}
        </div>
      </div>
    </ChromeContainer>
  );
}
