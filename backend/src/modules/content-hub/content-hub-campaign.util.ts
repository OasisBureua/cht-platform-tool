export type ContentHubPlatformSnapshot = {
  platform: string;
  status: string;
  syncedAt: string | null;
  rowCount: number | null;
};

export type ContentHubCampaignRecord = {
  id: number;
  name: string;
  clientSponsor: string | null;
  programName: string | null;
  diseaseState: string | null;
  campaignStatus: string | null;
  platforms: string[];
  hubspotCampaignId: string | null;
  reportingPeriodStart: string | null;
  reportingPeriodEnd: string | null;
  hubspotSyncedAt: string | null;
  hubspotRawData: unknown | null;
  surveySourceId: string | null;
  surveySourceProgramId: string | null;
  surveySourceLabel: string | null;
  platformSnapshots: ContentHubPlatformSnapshot[];
};

export function parseContentHubCampaign(
  raw: unknown,
): Omit<ContentHubCampaignRecord, 'platformSnapshots'> | null {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as Record<string, unknown>;
  const id = typeof row.id === 'number' ? row.id : Number(row.id);
  if (!Number.isFinite(id)) return null;

  const hubspotCampaignId =
    typeof row.hubspotCampaignId === 'string' && row.hubspotCampaignId.trim()
      ? row.hubspotCampaignId.trim()
      : null;

  const platforms = Array.isArray(row.platforms)
    ? row.platforms.filter((p): p is string => typeof p === 'string')
    : [];

  return {
    id,
    name:
      (typeof row.name === 'string' && row.name.trim()) || `Campaign ${id}`,
    clientSponsor:
      typeof row.clientSponsor === 'string' ? row.clientSponsor.trim() : null,
    programName:
      typeof row.programName === 'string' ? row.programName.trim() : null,
    diseaseState:
      typeof row.diseaseState === 'string' ? row.diseaseState.trim() : null,
    campaignStatus:
      typeof row.status === 'string' ? row.status.trim() : null,
    platforms,
    hubspotCampaignId,
    reportingPeriodStart: toIsoDate(
      typeof row.reportingPeriodStart === 'string'
        ? row.reportingPeriodStart
        : null,
    ),
    reportingPeriodEnd: toIsoDate(
      typeof row.reportingPeriodEnd === 'string' ? row.reportingPeriodEnd : null,
    ),
    hubspotSyncedAt:
      typeof row.hubspotSyncedAt === 'string' ? row.hubspotSyncedAt : null,
    hubspotRawData: row.hubspotRawData ?? null,
    surveySourceId:
      typeof row.surveySourceId === 'string' && row.surveySourceId.trim()
        ? row.surveySourceId.trim()
        : null,
    surveySourceProgramId:
      typeof row.surveySourceProgramId === 'string' &&
      row.surveySourceProgramId.trim()
        ? row.surveySourceProgramId.trim()
        : null,
    surveySourceLabel:
      typeof row.surveySourceLabel === 'string' && row.surveySourceLabel.trim()
        ? row.surveySourceLabel.trim()
        : null,
  };
}

export function parseContentHubPlatformData(raw: unknown): ContentHubPlatformSnapshot[] {
  if (!raw || typeof raw !== 'object') return [];
  const record = raw as Record<string, unknown>;
  const items = Array.isArray(record.items) ? record.items : [];

  return items
    .map((entry) => {
      if (!entry || typeof entry !== 'object') return null;
      const row = entry as Record<string, unknown>;
      const platform =
        typeof row.platform === 'string' ? row.platform.trim() : '';
      if (!platform) return null;

      return {
        platform,
        status: typeof row.status === 'string' ? row.status : 'missing',
        syncedAt: typeof row.syncedAt === 'string' ? row.syncedAt : null,
        rowCount:
          typeof row.rowCount === 'number' && Number.isFinite(row.rowCount)
            ? row.rowCount
            : null,
      } satisfies ContentHubPlatformSnapshot;
    })
    .filter((item): item is ContentHubPlatformSnapshot => item != null);
}

export function countAvailablePlatforms(
  snapshots: ContentHubPlatformSnapshot[],
): number {
  return snapshots.filter((s) => s.status === 'available').length;
}

function toIsoDate(value: string | null): string | null {
  if (!value?.trim()) return null;
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(value.trim());
  return match?.[1] ?? null;
}
