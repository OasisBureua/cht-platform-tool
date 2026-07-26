import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Upload,
  XCircle,
} from 'lucide-react';
import ChromeContainer from './components/ChromeContainer';
import { useHubspotStatus, useContentHubHealth, useIntegrations, useIntegrationsConnection, useUpdateIntegrations } from './lib/hooks';
import { cn } from './lib/utils';
import type { HubspotStatus, IntegrationSettings } from './lib/types';

type IntegrationKey = keyof IntegrationSettings;

interface IntegrationMeta {
  key: IntegrationKey;
  initials: string;
  color: string;
  name: string;
  description: string;
}

const INTEGRATIONS: IntegrationMeta[] = [
  { key: 'hubspot', initials: 'HS', color: '#ff7a59', name: 'HubSpot CRM', description: 'Contacts, forms, email stats, landing pages, funnel data' },
  { key: 'linkedin', initials: 'LI', color: '#0077b5', name: 'LinkedIn Campaign Manager', description: 'Ad impressions, clicks, engagement, audience reach, conversions' },
  { key: 'meta', initials: 'ME', color: '#1877f2', name: 'Meta Ads Manager', description: 'Ad spend, reach, impressions, clicks, conversions, audience insights' },
  { key: 'youtube', initials: 'YT', color: '#ff0000', name: 'YouTube Analytics', description: 'Views, watch time, audience retention, demographics, traffic sources' },
  { key: 'livestream', initials: 'LS', color: '#3da4c0', name: 'Zoom (Livestream)', description: 'Webinar attendance, peak viewers, and replay engagement via CHT Zoom integration' },
  { key: 'survey', initials: 'SV', color: '#2e7d32', name: 'Native Surveys', description: 'Post-event and intake survey responses collected on CHT' },
];

const SETUP_STEPS = [
  'Add HUBSPOT_ACCESS_TOKEN to CHT platform secrets (ECS / Secrets Manager).',
  'Token is never stored in Content Hub, CHT calls HubSpot server-to-server.',
  'On a campaign, open Data Sources and click Sync Now to pull HubSpot metrics.',
  'Reports use the last synced snapshot stored on the Hub campaign.',
];

const PRIMARY_BUTTON =
  'inline-flex h-9 items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-primary bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary-hover disabled:pointer-events-none disabled:opacity-50';

const OUTLINE_BUTTON =
  'inline-flex h-9 items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-50';

function HubspotBody({
  hubspotStatus,
  note,
}: {
  hubspotStatus: HubspotStatus | undefined;
  note?: string;
}) {
  const connected = Boolean(hubspotStatus?.connected);
  const displayNote =
    note ?? 'HUBSPOT_ACCESS_TOKEN in CHT platform secrets. Use Sync on campaign detail.';

  return (
    <div className="space-y-5 border-t border-border px-6 py-5">
      <div className="rounded-lg border border-border bg-muted/50 px-4 py-4">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-foreground">Status</p>
        <div className="flex flex-wrap items-center gap-3 text-sm">
          {connected ? (
            <span className="flex items-center gap-1.5 font-medium text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
              Connected
            </span>
          ) : (
            <span className="flex items-center gap-1.5 font-medium text-muted-foreground">
              <XCircle className="h-4 w-4" aria-hidden="true" />
              Not configured
            </span>
          )}
          {hubspotStatus?.accountName && (
            <span className="text-muted-foreground">{hubspotStatus.accountName}</span>
          )}
          {hubspotStatus?.portalId && (
            <span className="text-xs text-muted-foreground">Portal {hubspotStatus.portalId}</span>
          )}
        </div>
        {hubspotStatus?.error && !connected && (
          <p className="mt-2 text-xs text-accent">{hubspotStatus.error}</p>
        )}
      </div>
      <p className="text-sm text-muted-foreground">{displayNote}</p>
      <div className="rounded-lg bg-muted px-4 py-4">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-foreground">Setup</p>
        <ol className="space-y-1.5">
          {SETUP_STEPS.map((step, i) => (
            <li key={step} className="flex items-start gap-2 text-xs text-muted-foreground">
              <span className="mt-0.5 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full bg-primary/20 text-[9px] font-bold text-primary">
                {i + 1}
              </span>
              {step}
            </li>
          ))}
        </ol>
      </div>
      <div className="flex items-center gap-2">
        <a href="https://developers.hubspot.com/docs/api/private-apps" target="_blank" rel="noreferrer">
          <span className={cn(OUTLINE_BUTTON, 'px-3 text-xs')}>
            <ExternalLink className="h-3 w-3" aria-hidden="true" />
            HubSpot Private Apps docs
          </span>
        </a>
      </div>
      <div className="flex items-start gap-2 rounded-lg border border-accent/25 bg-accent/[0.08] px-3 py-2.5 text-xs text-muted-foreground">
        <Upload className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-accent" aria-hidden="true" />
        <span>
          API connection not ready yet? You can always upload CSV exports instead, go to a campaign and use the Upload
          tab.
        </span>
      </div>
    </div>
  );
}

function SimpleBody({
  integrationKey,
  name,
  enabled,
  note,
}: {
  integrationKey: IntegrationKey;
  name: string;
  enabled: boolean;
  note: string;
}) {
  const { toast } = useToast();
  const [isEnabled, setIsEnabled] = useState(enabled);
  const saveMutation = useUpdateIntegrations();

  const save = () =>
    saveMutation.mutate(
      { [integrationKey]: { enabled: isEnabled } },
      {
        onSuccess: () => toast({ title: `${name} settings saved` }),
        onError: (err: Error) => toast({ title: 'Failed to save settings', description: err.message, variant: 'destructive' }),
      },
    );

  return (
    <div className="space-y-5 border-t border-border px-6 py-5">
      <div className="flex items-start gap-2 rounded-lg bg-muted px-3 py-2.5 text-xs text-muted-foreground">
        <Upload className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
        <span>{note}</span>
      </div>
      <div className="flex items-center gap-2">
        <label className="flex cursor-pointer items-center gap-2 text-sm text-foreground">
          <input
            type="checkbox"
            checked={isEnabled}
            onChange={(e) => setIsEnabled(e.target.checked)}
            className="h-4 w-4 accent-[hsl(var(--primary))]"
          />
          Enable this integration
        </label>
        <button className={cn(PRIMARY_BUTTON, 'ml-auto')} onClick={save} disabled={saveMutation.isPending}>
          {saveMutation.isPending ? 'Saving…' : 'Save'}
        </button>
      </div>
    </div>
  );
}

export default function Integrations() {
  const [openKey, setOpenKey] = useState<IntegrationKey | null>(null);

  const { data: settings } = useIntegrations();
  const { data: connections } = useIntegrationsConnection();
  const { data: hubspotStatus } = useHubspotStatus();
  const { data: health } = useContentHubHealth();

  const isConnected = (key: IntegrationKey): boolean =>
    Boolean(connections?.[key]?.connected);

  const connectedCount = INTEGRATIONS.filter((i) => isConnected(i.key)).length;

  return (
    <ChromeContainer>
      <div className="max-w-3xl">
        <div className="mb-7 flex items-center gap-3">
          <Link to="/admin/content-hub" className="text-muted-foreground transition-colors hover:text-foreground" aria-label="Back to reports">
            <ArrowLeft className="h-5 w-5" aria-hidden="true" />
          </Link>
          <div className="flex-1">
            <div className="flex items-baseline gap-3">
              <h1 className="text-2xl font-bold text-foreground">Integrations</h1>
              <span className="text-sm text-muted-foreground">{connectedCount} of 6 connected</span>
            </div>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Connection status per data source. HubSpot, Zoom, and native surveys are managed on CHT;
              LinkedIn, Meta, and YouTube are managed on Content Hub.
            </p>
            {health?.contentHub.reachable && (
              <p className="mt-2 text-xs text-muted-foreground">
                Content Hub admin API is reachable.
              </p>
            )}
            {health && health.contentHub.configured && !health.contentHub.reachable && (
              <p className="mt-2 text-xs text-accent">
                {health.contentHub.error ?? 'Content Hub configured but not reachable.'}
              </p>
            )}
          </div>
        </div>
        <div className="space-y-3">
          {INTEGRATIONS.map((integration) => {
            const open = openKey === integration.key;
            const connected = isConnected(integration.key);
            return (
              <div key={integration.key} className="overflow-hidden rounded-xl border border-border bg-card">
                <button
                  className="flex w-full items-center justify-between px-6 py-5 transition-colors hover:bg-muted"
                  onClick={() => setOpenKey(open ? null : integration.key)}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-[10px] font-black uppercase text-white"
                      style={{ backgroundColor: integration.color }}
                    >
                      {integration.initials}
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-semibold text-foreground">{integration.name}</p>
                      <p className="text-xs text-muted-foreground">{integration.description}</p>
                    </div>
                  </div>
                  <div className="ml-4 flex flex-shrink-0 items-center gap-3">
                    {connected ? (
                      <span className="flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                        <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                        Connected
                      </span>
                    ) : (
                      <span className="flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
                        <XCircle className="h-3.5 w-3.5" aria-hidden="true" />
                        Not connected
                      </span>
                    )}
                    {open ? (
                      <ChevronUp className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                    )}
                  </div>
                </button>
                {open &&
                  (integration.key === 'hubspot' ? (
                    <HubspotBody
                      hubspotStatus={hubspotStatus}
                      note={connections?.hubspot?.note}
                    />
                  ) : (
                    <SimpleBody
                      key={`${integration.key}-${String(settings?.[integration.key]?.enabled)}`}
                      integrationKey={integration.key}
                      name={integration.name}
                      enabled={Boolean(settings?.[integration.key]?.enabled)}
                      note={settings?.[integration.key]?.note ?? ''}
                    />
                  ))}
              </div>
            );
          })}
        </div>
      </div>
    </ChromeContainer>
  );
}
