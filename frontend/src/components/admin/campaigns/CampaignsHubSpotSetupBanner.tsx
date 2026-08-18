import { AlertTriangle, ExternalLink } from 'lucide-react';
import type { CampaignsDashboardResponse } from '../../../api/admin';

export function CampaignsHubSpotSetupBanner({
  data,
}: {
  data: CampaignsDashboardResponse;
}) {
  if (data.hubspot.marketingScopesGranted === true) return null;

  const scopes = (data.hubspot.missingScopes ?? []).join(', ') ||
    'marketing.campaigns.read, marketing-email';

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/50 dark:bg-amber-950/25">
      <div className="flex gap-3">
        <AlertTriangle
          className="mt-0.5 h-5 w-5 shrink-0 text-amber-700 dark:text-amber-300"
          aria-hidden
        />
        <div className="space-y-2 text-sm text-amber-950 dark:text-amber-100">
          <p className="font-semibold">
            HubSpot marketing scopes are missing — live metrics cannot be loaded
          </p>
          <p>
            Your token is connected to portal{' '}
            <span className="font-mono">{data.hubspot.portalId ?? '—'}</span> for
            CRM contact sync, but campaign metrics need Marketing Hub API scopes.
          </p>
          <ol className="list-decimal space-y-1 pl-5">
            <li>
              In HubSpot, open <strong>Settings → Integrations → Private Apps</strong>
            </li>
            <li>
              Add scopes: <code className="font-mono text-xs">{scopes}</code>
              {' '}(email stats use <strong>marketing-email</strong> under Other, or <strong>content</strong> if listed)
            </li>
            <li>Regenerate the token and update <code className="font-mono text-xs">HUBSPOT_ACCESS_TOKEN</code></li>
            <li>
              In Content Hub, link each campaign with a HubSpot campaign ID and run{' '}
              <strong>HubSpot sync</strong>
            </li>
          </ol>
          <a
            href={data.hubspot.scopeSetupUrl ?? 'https://developers.hubspot.com/docs/apps/developer-platform/build-apps/authentication/scopes'}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 font-medium text-amber-900 underline underline-offset-2 hover:text-amber-950 dark:text-amber-200"
          >
            HubSpot scopes documentation
            <ExternalLink className="h-3.5 w-3.5" aria-hidden />
          </a>
        </div>
      </div>
    </div>
  );
}

export function CampaignsDashboardAlerts({
  warnings = [],
}: {
  warnings?: string[];
}) {
  if (!warnings.length) return null;

  return (
    <div className="space-y-2">
      {warnings.map((warning) => (
        <div
          key={warning}
          className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-200"
        >
          {warning}
        </div>
      ))}
    </div>
  );
}

