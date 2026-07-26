// react-query hooks for Content Hub. Thin wrappers over store.ts (localStorage today,
// real NestJS endpoints later: see the seam comment in store.ts). Using the platform's
// shared QueryClient (from App.tsx) is fine: these query keys are namespaced under
// 'content-hub' so they never collide with the rest of the admin app.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '../../../../api/admin';
import { surveysApi, type Survey } from '../../../../api/surveys';
import * as store from './store';
import type {
  Campaign,
  HubspotStatus,
  IntegrationSettings,
  Platform,
  Template,
} from './types';

const KEY = 'content-hub';

export const qk = {
  campaigns: () => [KEY, 'campaigns'] as const,
  campaign: (id: string | number) => [KEY, 'campaign', String(id)] as const,
  csvData: (id: string | number) => [KEY, 'campaign', String(id), 'csv-data'] as const,
  validation: (id: string | number) => [KEY, 'campaign', String(id), 'data-validation'] as const,
  report: (id: string | number) => [KEY, 'campaign', String(id), 'report'] as const,
  executiveReport: (id: string | number) => [KEY, 'campaign', String(id), 'executive-report'] as const,
  templates: () => [KEY, 'templates'] as const,
  integrations: () => [KEY, 'integrations'] as const,
  integrationsConnection: () => [KEY, 'integrations-connection'] as const,
  hubspotStatus: () => [KEY, 'hubspot-status'] as const,
  contentHubHealth: () => [KEY, 'health'] as const,
  feedbackSurveys: () => [KEY, 'feedback-surveys'] as const,
};

const n = (id: string | number) => Number(id);

// ---------- Campaigns ----------
export function useCampaigns() {
  return useQuery({ queryKey: qk.campaigns(), queryFn: () => store.listCampaigns() });
}

export function useCampaign(id: string | number, enabled = true) {
  return useQuery({ queryKey: qk.campaign(id), queryFn: () => store.getCampaign(n(id)), enabled });
}

export function useCreateCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Partial<Campaign>) => Promise.resolve(store.createCampaign(body)),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.campaigns() }),
  });
}

export function useUpdateCampaign(id: string | number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Partial<Campaign>) => Promise.resolve(store.updateCampaign(n(id), body)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.campaigns() });
      qc.invalidateQueries({ queryKey: qk.campaign(id) });
    },
  });
}

export function useDeleteCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string | number) => Promise.resolve(store.deleteCampaign(n(id))),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.campaigns() }),
  });
}

// ---------- Campaign data ----------
export function useCsvData(id: string | number) {
  return useQuery({ queryKey: qk.csvData(id), queryFn: () => store.getCsvData(n(id)) });
}

export function useDataValidation(id: string | number, enabled = true) {
  return useQuery({ queryKey: qk.validation(id), queryFn: () => store.getDataValidation(n(id)), enabled });
}

export function useUploadCsv(id: string | number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: { platform: Platform; filename: string; content: string }) =>
      Promise.resolve(store.uploadCsv(n(id), args.platform, args.filename, args.content)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.csvData(id) });
      qc.invalidateQueries({ queryKey: qk.validation(id) });
    },
  });
}

export function useFeedbackSurveys(enabled = true) {
  return useQuery({
    queryKey: qk.feedbackSurveys(),
    queryFn: async (): Promise<Survey[]> => {
      const data = await surveysApi.getAll();
      const byId = new Map(
        [...data.active, ...data.completed]
          .filter((survey) => survey.type === 'FEEDBACK' && survey.program)
          .map((survey) => [survey.id, survey]),
      );
      return [...byId.values()].sort((a, b) =>
        (a.program?.title ?? a.title).localeCompare(
          b.program?.title ?? b.title,
        ),
      );
    },
    enabled,
  });
}

export function useConnectFeedbackSurvey(id: string | number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (survey: Survey) => {
      const data = await adminApi.getSurveyAnalytics(survey.id, {
        includeSamples: true,
      });
      return store.connectFeedbackSurvey(n(id), {
        surveyId: survey.id,
        programId: survey.program?.id ?? null,
        label: `${survey.program?.title ?? 'Program'}: ${survey.title}`,
        totalResponses: data.analytics.totals.totalResponses,
        analytics: data.analytics,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.csvData(id) });
      qc.invalidateQueries({ queryKey: qk.validation(id) });
      qc.invalidateQueries({ queryKey: qk.campaign(id) });
    },
  });
}

export function useHubspotSync(id: string | number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => Promise.resolve(store.hubspotSync(n(id))),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.campaign(id) }),
  });
}

export function useGenerateInsights(id: string | number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => Promise.resolve(store.generateAiInsights(n(id))),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.report(id) }),
  });
}

// ---------- Reports ----------
export function useAnalyticsReport(id: string | number) {
  return useQuery({ queryKey: qk.report(id), queryFn: () => store.getAnalyticsReport(n(id)) });
}

export function useExecutiveReport(id: string | number) {
  return useQuery({ queryKey: qk.executiveReport(id), queryFn: () => store.getExecutiveReport(n(id)) });
}

// ---------- Templates ----------
export function useTemplates() {
  return useQuery({ queryKey: qk.templates(), queryFn: () => store.listTemplates() });
}

export function useCreateTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { name: string; type: string; description: string }) =>
      Promise.resolve(store.createTemplate(body)),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.templates() }),
  });
}

export function useDeleteTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => Promise.resolve(store.deleteTemplate(id)),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.templates() }),
  });
}

// ---------- Integrations ----------
export function useIntegrations() {
  return useQuery({ queryKey: qk.integrations(), queryFn: () => store.getIntegrations() });
}

export function useUpdateIntegrations() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: Partial<Record<keyof IntegrationSettings, unknown>>) =>
      Promise.resolve(store.updateIntegrations(patch)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.integrations() });
      qc.invalidateQueries({ queryKey: qk.integrationsConnection() });
      qc.invalidateQueries({ queryKey: qk.hubspotStatus() });
      qc.invalidateQueries({ queryKey: qk.contentHubHealth() });
    },
  });
}

export function useContentHubHealth(enabled = true) {
  return useQuery({
    queryKey: qk.contentHubHealth(),
    queryFn: () => store.getContentHubHealth(),
    enabled,
    staleTime: 60_000,
  });
}

export function useIntegrationsConnection(enabled = true) {
  return useQuery({
    queryKey: qk.integrationsConnection(),
    queryFn: () => store.getIntegrationsConnection(),
    enabled,
    staleTime: 60_000,
  });
}

export function useHubspotStatus(enabled = true) {
  const query = useIntegrationsConnection(enabled);
  const hubspot = query.data?.hubspot;
  return {
    ...query,
    data: hubspot
      ? ({
          connected: hubspot.connected,
          accountName: hubspot.accountName ?? null,
          portalId: hubspot.portalId ?? null,
          error: hubspot.error,
        } satisfies HubspotStatus)
      : undefined,
  };
}

export type { Template };
