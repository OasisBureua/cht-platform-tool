/** Scopes required for the campaigns dashboard live metrics pull. */
export const HUBSPOT_CAMPAIGNS_DASHBOARD_SCOPES = [
  'marketing.campaigns.read',
  'marketing.email.read',
] as const;

/** Human-friendly scope labels as shown in HubSpot private app UI. */
export const HUBSPOT_CAMPAIGNS_DASHBOARD_SCOPE_LABELS = [
  'marketing.campaigns.read',
  'marketing-email (or content)',
] as const;

export type HubSpotParsedError = {
  status: number | null;
  category: string | null;
  message: string;
  missingScopes: string[];
};

export function parseHubSpotApiError(raw: unknown): HubSpotParsedError {
  const fallback: HubSpotParsedError = {
    status: null,
    category: null,
    message: raw instanceof Error ? raw.message : String(raw),
    missingScopes: [],
  };

  const text = fallback.message;
  const statusMatch = /HubSpot (\d{3})/.exec(text);
  const status = statusMatch ? Number(statusMatch[1]) : null;

  const jsonStart = text.indexOf('{');
  if (jsonStart < 0) {
    return { ...fallback, status };
  }

  try {
    const body = JSON.parse(text.slice(jsonStart)) as Record<string, unknown>;
    const category =
      typeof body.category === 'string' ? body.category : null;
    const message =
      typeof body.message === 'string' ? body.message : fallback.message;
    const missingScopes = extractMissingScopes(body);

    return { status, category, message, missingScopes };
  } catch {
    return { ...fallback, status };
  }
}

function extractMissingScopes(body: Record<string, unknown>): string[] {
  const scopes = new Set<string>();

  const errors = Array.isArray(body.errors) ? body.errors : [];
  for (const entry of errors) {
    if (!entry || typeof entry !== 'object') continue;
    const row = entry as Record<string, unknown>;
    const context =
      row.context && typeof row.context === 'object'
        ? (row.context as Record<string, unknown>)
        : null;
    const required = context?.requiredGranularScopes;
    if (Array.isArray(required)) {
      for (const scope of required) {
        if (typeof scope === 'string' && scope.trim()) {
          scopes.add(scope.trim());
        }
      }
    }
  }

  if (body.category === 'MISSING_PERMISSIONS') {
    for (const scope of HUBSPOT_CAMPAIGNS_DASHBOARD_SCOPES) {
      scopes.add(scope);
    }
  }

  return [...scopes];
}

export function humanizeHubSpotPermissionError(
  parsed: HubSpotParsedError,
): string {
  if (parsed.category === 'MISSING_SCOPES' && parsed.missingScopes.length) {
    return `HubSpot token is missing scopes: ${parsed.missingScopes.join(', ')}. Add them to your private app and regenerate the token.`;
  }
  if (parsed.category === 'MISSING_PERMISSIONS' || parsed.status === 403) {
    return `HubSpot token lacks Marketing Hub campaign permissions (needs marketing.campaigns.read and marketing-email or content for email stats). Marketing Hub Professional or Enterprise is required.`;
  }
  return parsed.message;
}

export function dedupeStrings(values: string[]): string[] {
  return [...new Set(values.filter((v) => v.trim()))];
}
