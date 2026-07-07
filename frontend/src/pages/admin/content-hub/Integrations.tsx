import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  ExternalLink,
  RefreshCw,
  Upload,
  XCircle,
} from 'lucide-react';
import ChromeContainer from './components/ChromeContainer';
import { useToast } from './components/Toaster';
import { useHubspotStatus, useIntegrations, useUpdateIntegrations } from './lib/hooks';
import * as store from './lib/store';
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
  { key: 'livestream', initials: 'LS', color: '#3da4c0', name: 'Livestream Platform', description: 'Attendance, peak viewers, engagement, replay views, Q&A activity' },
  { key: 'survey', initials: 'SV', color: '#2e7d32', name: 'Survey Platform', description: 'Response rates, satisfaction scores, NPS, open-ended feedback themes' },
];

const SETUP_STEPS = [
  'Go to HubSpot → Settings → Integrations → Private Apps',
  'Click Create a private app and name it CHM Reporting',
  'Grant scopes: crm.objects.contacts.read, forms, marketing-email',
  'Copy the generated token and paste it above',
];

const PRIMARY_BUTTON =
  'inline-flex h-9 items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-primary bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary-hover disabled:pointer-events-none disabled:opacity-50';

const OUTLINE_BUTTON =
  'inline-flex h-9 items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-50';

function HubspotBody({
  settings,
  hubspotStatus,
}: {
  settings: IntegrationSettings | undefined;
  hubspotStatus: HubspotStatus | undefined;
}) {
  const { toast } = useToast();
  const [token, setToken] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [testing, setTesting] = useState(false);
  const saveMutation = useUpdateIntegrations();

  const save = () =>
    saveMutation.mutate(
      { hubspot: { token } },
      {
        onSuccess: () =>
          toast({ title: 'HubSpot token saved', description: 'Credentials stored and masked in API responses.' }),
        onError: (err: Error) =>
          toast({ title: 'Failed to save token', description: err.message, variant: 'destructive' }),
      },
    );

  const handleTest = () => {
    setTesting(true);
    try {
      const status = store.getHubspotStatus();
      if (status.connected) {
        toast({
          title: 'HubSpot connected',
          description: status.accountName ? `Connected to ${status.accountName}.` : 'Connection is working.',
        });
      } else {
        toast({ title: 'HubSpot not connected', description: status.error ?? 'Connection test failed.', variant: 'destructive' });
      }
    } catch (err) {
      toast({ title: 'Connection test failed', description: (err as Error).message, variant: 'destructive' });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="space-y-5 border-t border-border px-6 py-5">
      <div className="grid gap-4">
        <div>
          <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Private App Token
          </label>
          <div className="relative">
            <input
              className="flex h-9 w-full rounded-lg border border-border bg-background px-3 py-1 pr-9 font-mono text-sm text-foreground shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              placeholder={settings?.hubspot.token || 'pat-na1-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx'}
              type={showToken ? 'text' : 'password'}
              value={token}
              onChange={(e) => setToken(e.target.value)}
            />
            <button
              type="button"
              onClick={() => setShowToken((v) => !v)}
              aria-label={showToken ? 'Hide token' : 'Show token'}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showToken ? <EyeOff className="h-3.5 w-3.5" aria-hidden="true" /> : <Eye className="h-3.5 w-3.5" aria-hidden="true" />}
            </button>
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">Create under HubSpot Settings → Integrations → Private Apps.</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button className={PRIMARY_BUTTON} onClick={save} disabled={saveMutation.isPending}>
          {saveMutation.isPending ? 'Saving…' : 'Save'}
        </button>
        <button className={OUTLINE_BUTTON} onClick={handleTest} disabled={testing}>
          <RefreshCw className={cn('h-3.5 w-3.5', testing && 'animate-spin')} aria-hidden="true" />
          Test
        </button>
        <a href="https://developers.hubspot.com/docs/api/private-apps" target="_blank" rel="noreferrer" className="ml-auto">
          <span className={cn(OUTLINE_BUTTON, 'px-3 text-xs')}>
            <ExternalLink className="h-3 w-3" aria-hidden="true" />
            HubSpot Private Apps docs
          </span>
        </a>
      </div>
      <div className="rounded-lg bg-muted px-4 py-4">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-foreground">Setup steps</p>
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
      <div className="flex items-start gap-2 rounded-lg border border-accent/25 bg-accent/[0.08] px-3 py-2.5 text-xs text-muted-foreground">
        <Upload className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-accent" aria-hidden="true" />
        <span>
          API connection not ready yet? You can always upload CSV exports instead — go to a campaign and use the Upload
          tab.
        </span>
      </div>
      {hubspotStatus?.error && !hubspotStatus.connected && (
        <p className="text-[11px] text-muted-foreground">{hubspotStatus.error}</p>
      )}
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
  const { data: hubspotStatus } = useHubspotStatus();

  const isConnected = (key: IntegrationKey): boolean => {
    if (key === 'hubspot') return Boolean(hubspotStatus?.connected || settings?.hubspot.enabled);
    return Boolean(settings?.[key]?.enabled);
  };

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
              Connect data sources so reports can pull live metrics automatically. Credentials are stored in your
              database and masked in API responses.
            </p>
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
                    <HubspotBody settings={settings} hubspotStatus={hubspotStatus} />
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
