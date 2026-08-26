import type { CampaignDashboardRow } from '../../../api/admin';

export function campaignDashboardId(
  campaign: Pick<CampaignDashboardRow, 'hubspotCampaignId' | 'contentHubCampaignId'>,
): string | null {
  if (campaign.hubspotCampaignId?.trim()) return campaign.hubspotCampaignId.trim();
  if (campaign.contentHubCampaignId != null) {
    return `ch-${campaign.contentHubCampaignId}`;
  }
  return null;
}

export function campaignDashboardPath(
  campaign: Pick<CampaignDashboardRow, 'hubspotCampaignId' | 'contentHubCampaignId'>,
): string {
  const id = campaignDashboardId(campaign);
  return id
    ? `/admin/campaigns-dashboard/${encodeURIComponent(id)}`
    : '/admin/campaigns-dashboard';
}

export function findCampaignByDashboardId(
  campaigns: CampaignDashboardRow[],
  rawId: string,
): CampaignDashboardRow | undefined {
  const id = decodeURIComponent(rawId);
  return campaigns.find((campaign) => campaignDashboardId(campaign) === id);
}
