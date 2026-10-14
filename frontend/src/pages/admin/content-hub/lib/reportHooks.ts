// react-query hooks for on-demand campaign reports (cht-reports via the
// Platform reports API) and the Program → Hub campaign link.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '../../../../api/admin';
import {
  REPORT_IN_FLIGHT,
  campaignKolsApi,
  campaignLinksApi,
  reportsApi,
  type CreateReportInput,
  type Report,
} from '../../../../api/reports';

const KEY = 'content-hub';
const POLL_MS = 5_000;

export const reportKeys = {
  list: (campaignId: string) => [KEY, 'reports', campaignId] as const,
  recipients: () => [KEY, 'report-recipients'] as const,
  linkPrograms: () => [KEY, 'campaign-link-programs'] as const,
  campaignKols: (campaignId: string) => [KEY, 'campaign-kols', campaignId] as const,
  kolRoster: () => [KEY, 'kol-roster'] as const,
};

export function hasInFlight(reports: Report[] | undefined): boolean {
  return !!reports?.some((r) => REPORT_IN_FLIGHT.has(r.status));
}

/** Lists a campaign's reports and polls while any of them is still generating. */
export function useCampaignReports(campaignId: string) {
  return useQuery({
    queryKey: reportKeys.list(campaignId),
    queryFn: () => reportsApi.list(campaignId),
    enabled: !!campaignId,
    refetchInterval: (query) =>
      hasInFlight(query.state.data as Report[] | undefined) ? POLL_MS : false,
    refetchIntervalInBackground: false,
  });
}

function upsert(list: Report[] | undefined, report: Report): Report[] {
  const rest = (list ?? []).filter((r) => r.reportId !== report.reportId);
  return [report, ...rest].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function useCreateReport(campaignId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Omit<CreateReportInput, 'campaignId'>) =>
      reportsApi.create({ ...input, campaignId }),
    onSuccess: (report) => {
      qc.setQueryData<Report[]>(reportKeys.list(campaignId), (prev) =>
        upsert(prev, report),
      );
    },
  });
}

export function useRegenerateReport(campaignId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: { reportId: string; editInstructions?: string }) =>
      reportsApi.regenerate(args.reportId, campaignId, args.editInstructions),
    onSuccess: (report) => {
      qc.setQueryData<Report[]>(reportKeys.list(campaignId), (prev) =>
        upsert(prev, report),
      );
    },
    onError: () => qc.invalidateQueries({ queryKey: reportKeys.list(campaignId) }),
  });
}

export function useDownloadReport() {
  return useMutation({ mutationFn: (report: Report) => reportsApi.download(report) });
}

/** CPR-41 — pull platform data into Hub without generating a report. */
export function useRefreshCampaignData(campaignId: string) {
  return useMutation({
    mutationFn: () => reportsApi.refreshData(campaignId),
  });
}

export function useReportRecipients(enabled = true) {
  return useQuery({
    queryKey: reportKeys.recipients(),
    queryFn: () => reportsApi.notifyRecipients(),
    enabled,
    staleTime: 5 * 60_000,
  });
}

export function useCampaignLinkPrograms() {
  return useQuery({
    queryKey: reportKeys.linkPrograms(),
    queryFn: () => campaignLinksApi.listPrograms(),
    staleTime: 60_000,
  });
}

export function useSetProgramCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: { programId: string; campaignId: string | null }) =>
      campaignLinksApi.setProgramCampaign(args.programId, args.campaignId),
    onSuccess: (updated) => {
      qc.setQueryData(
        reportKeys.linkPrograms(),
        (prev: Awaited<ReturnType<typeof campaignLinksApi.listPrograms>> | undefined) =>
          prev?.map((p) => (p.id === updated.id ? updated : p)),
      );
    },
  });
}

export function useCampaignKols(campaignId: string) {
  return useQuery({
    queryKey: reportKeys.campaignKols(campaignId),
    queryFn: () => campaignKolsApi.list(campaignId),
    enabled: !!campaignId,
  });
}

export function useSetCampaignKols(campaignId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (kolIds: string[]) => campaignKolsApi.set(campaignId, kolIds),
    onSuccess: (kols) => qc.setQueryData(reportKeys.campaignKols(campaignId), kols),
  });
}

/** Full Hub KOL roster for the picker. */
export function useKolRoster(enabled = true) {
  return useQuery({
    queryKey: reportKeys.kolRoster(),
    queryFn: async () => (await adminApi.getKolNetwork()).items,
    enabled,
    staleTime: 5 * 60_000,
  });
}
