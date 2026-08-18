import type { CampaignsDashboardResponse } from '../../../api/admin';

type CampaignDataSource = CampaignsDashboardResponse['campaigns'][0]['dataSource'];

export function dataSourceLabel(source: CampaignDataSource): string {
  switch (source) {
    case 'live':
      return 'Live';
    case 'cached':
      return 'Cached sync';
    case 'content_hub':
      return 'Content Hub';
    default:
      return 'List only';
  }
}

export function dataSourceBadgeClass(source: CampaignDataSource): string {
  switch (source) {
    case 'live':
      return 'bg-green-100 text-green-800 dark:bg-green-950/40 dark:text-green-300';
    case 'cached':
      return 'bg-sky-100 text-sky-800 dark:bg-sky-950/40 dark:text-sky-300';
    case 'content_hub':
      return 'bg-violet-100 text-violet-800 dark:bg-violet-950/40 dark:text-violet-300';
    default:
      return 'bg-gray-100 text-gray-600 dark:bg-zinc-800 dark:text-zinc-400';
  }
}
