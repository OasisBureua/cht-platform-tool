import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import {
  ClipboardList,
  ExternalLink,
  Loader2,
  Pencil,
  RefreshCw,
} from 'lucide-react';
import { adminApi, type ZoomSessionSurvey } from '../../api/admin';
import { getApiErrorMessage } from '../../api/client';
import { adminSurveyDisplayTitle } from '../../utils/admin-survey-display';
import {
  Button,
  ZoomAlert,
  ZoomSectionCard,
  ZoomStatusBadge,
} from './zoom-recordings/ZoomRecordingsUi';

function surveyTypeLabel(type: string): string {
  switch (type) {
    case 'INTAKE':
      return 'Intake';
    case 'FEEDBACK':
      return 'Post-event';
    case 'PRE_TEST':
      return 'Pre-test';
    case 'POST_TEST':
      return 'Post-test';
    default:
      return type.replace(/_/g, ' ');
  }
}

function surveyStatusLabel(survey: ZoomSessionSurvey): {
  tone: 'success' | 'warning' | 'neutral' | 'info';
  label: string;
} {
  if (survey.responseCount > 0) {
    return { tone: 'success', label: 'Collecting responses' };
  }
  if (survey.isCustomized) {
    return { tone: 'info', label: 'Customized' };
  }
  return { tone: 'neutral', label: 'Ready' };
}

function formatDateTime(value: string | null | undefined): string {
  if (!value?.trim()) return '—';
  try {
    return format(parseISO(value), 'MMM d, yyyy · h:mm a');
  } catch {
    return '—';
  }
}

export function ZoomSessionSurveysSection({
  sessionId,
  linked,
  programId,
  programTitle,
}: {
  sessionId: string;
  linked: boolean;
  programId: string | null;
  programTitle: string | null;
}) {
  const queryClient = useQueryClient();
  const surveysQueryKey = ['admin', 'zoom-recordings', 'session', sessionId, 'surveys'] as const;

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: surveysQueryKey,
    queryFn: () => adminApi.listZoomSessionSurveys(sessionId),
    enabled: !!sessionId,
    staleTime: 0,
  });

  const ensureMut = useMutation({
    mutationFn: () => {
      if (!programId) throw new Error('Program is required');
      return adminApi.ensureNativeSurveysForProgram(programId);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: surveysQueryKey });
      void queryClient.invalidateQueries({ queryKey: ['admin', 'surveys'] });
      if (programId) {
        void queryClient.invalidateQueries({
          queryKey: ['admin', 'programs', programId, 'registrations'],
        });
      }
    },
  });

  const canFetch = linked && (data?.canFetchSurveys ?? linked);
  const surveys = data?.surveys ?? [];
  const legacyForms = data?.legacyForms ?? [];
  const unlinkedReason =
    data?.reason ??
    'Link this session to a Program to fetch and view surveys.';

  const ensureDisabled = !canFetch || ensureMut.isPending;
  const ensureTitle = !canFetch
    ? unlinkedReason
    : 'Create any missing native intake or post-event survey without changing existing responses.';

  const action = (
    <Button
      variant="outline"
      size="sm"
      disabled={ensureDisabled}
      title={ensureTitle}
      onClick={() => {
        if (
          !window.confirm(
            'Create any missing native intake or post-event survey? Existing surveys, customizations, and responses will not be changed.',
          )
        ) {
          return;
        }
        ensureMut.mutate();
      }}
    >
      {ensureMut.isPending ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <RefreshCw className="h-4 w-4" />
      )}
      {ensureMut.isPending ? 'Checking…' : 'Ensure native surveys'}
    </Button>
  );

  return (
    <ZoomSectionCard
      title="Surveys"
      description={
        canFetch
          ? `Surveys linked to ${programTitle || data?.programTitle || 'this program'} in CHT (native and Jotform).`
          : 'Surveys are stored on the linked Program — not in Zoom.'
      }
      action={action}
    >
      {!canFetch ? (
        <div className="space-y-3">
          <ZoomAlert tone="info" title="Program required">
            {unlinkedReason}
          </ZoomAlert>
          <div
            className="pointer-events-none select-none rounded-lg border border-dashed border-border bg-muted/30 px-4 py-8 text-center opacity-70"
            aria-disabled="true"
          >
            <ClipboardList
              className="mx-auto mb-2 h-8 w-8 text-muted-foreground"
              aria-hidden
            />
            <p className="text-sm font-medium text-foreground">Surveys unavailable</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Link this session to a Program above, then surveys will appear here.
            </p>
          </div>
        </div>
      ) : isLoading ? (
        <div className="flex flex-col items-center justify-center gap-3 py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-hidden />
          <p className="text-sm text-muted-foreground">Loading surveys…</p>
        </div>
      ) : isError ? (
        <div className="space-y-3">
          <ZoomAlert tone="error" title="Could not load surveys">
            {getApiErrorMessage(error) || 'Something went wrong. Please try again.'}
          </ZoomAlert>
          <Button variant="outline" size="sm" onClick={() => void refetch()} disabled={isFetching}>
            {isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Retry
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {ensureMut.isError ? (
            <ZoomAlert tone="error" title="Could not ensure native surveys">
              {getApiErrorMessage(ensureMut.error) || 'Please try again.'}
            </ZoomAlert>
          ) : null}
          {ensureMut.isSuccess ? (
            <ZoomAlert tone="success">
              Native intake and post-event surveys are present. Existing surveys were left unchanged.
            </ZoomAlert>
          ) : null}

          {surveys.length === 0 && legacyForms.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border bg-muted/20 px-4 py-8 text-center">
              <ClipboardList
                className="mx-auto mb-2 h-8 w-8 text-muted-foreground"
                aria-hidden
              />
              <p className="text-sm font-medium text-foreground">No surveys yet</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Use <strong className="font-medium text-foreground">Ensure native surveys</strong> to
                attach intake and post-event templates, or open{' '}
                {programId ? (
                  <Link
                    to={`/admin/programs/${programId}/hub?tab=surveys`}
                    className="font-medium text-brand-700 underline-offset-2 hover:underline dark:text-brand-300"
                  >
                    Program Hub
                  </Link>
                ) : (
                  'Program Hub'
                )}{' '}
                to manage surveys.
              </p>
            </div>
          ) : (
            <>
              {surveys.length > 0 ? (
                <div className="overflow-x-auto rounded-lg border border-border">
                  <table className="w-full min-w-[640px] text-sm">
                    <thead className="border-b border-border bg-muted/40">
                      <tr>
                        <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          Survey
                        </th>
                        <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          Type
                        </th>
                        <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          Source
                        </th>
                        <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          Status
                        </th>
                        <th className="px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          Responses
                        </th>
                        <th className="px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {surveys.map((survey) => {
                        const status = surveyStatusLabel(survey);
                        const displayTitle = adminSurveyDisplayTitle(
                          programTitle || data?.programTitle,
                          survey.type,
                          survey.title,
                        );
                        return (
                          <tr key={survey.id} className="bg-card hover:bg-muted/30">
                            <td className="px-3 py-3 align-top">
                              <p className="font-medium text-foreground">{displayTitle}</p>
                              {survey.lastResponseAt ? (
                                <p className="mt-0.5 text-xs text-muted-foreground">
                                  Last response {formatDateTime(survey.lastResponseAt)}
                                </p>
                              ) : (
                                <p className="mt-0.5 text-xs text-muted-foreground">
                                  Created {formatDateTime(survey.createdAt)}
                                </p>
                              )}
                            </td>
                            <td className="px-3 py-3 align-top text-muted-foreground">
                              {surveyTypeLabel(survey.type)}
                            </td>
                            <td className="px-3 py-3 align-top">
                              <ZoomStatusBadge
                                tone={survey.source === 'jotform' ? 'info' : 'neutral'}
                              >
                                {survey.source === 'jotform' ? 'Jotform' : 'Native'}
                              </ZoomStatusBadge>
                            </td>
                            <td className="px-3 py-3 align-top">
                              <ZoomStatusBadge tone={status.tone}>{status.label}</ZoomStatusBadge>
                            </td>
                            <td className="px-3 py-3 align-top text-right tabular-nums text-foreground">
                              {survey.responseCount}
                            </td>
                            <td className="px-3 py-3 align-top">
                              <div className="flex flex-wrap items-center justify-end gap-2">
                                <Link
                                  to={`/admin/surveys/${survey.id}/responses`}
                                  className="inline-flex items-center gap-1 rounded-[6px] border border-border bg-card px-2 py-1 text-xs font-semibold text-foreground hover:bg-muted"
                                >
                                  Responses
                                </Link>
                                <Link
                                  to={`/admin/surveys/${survey.id}/edit`}
                                  className="inline-flex items-center gap-1 rounded-[6px] border border-border bg-card px-2 py-1 text-xs font-semibold text-foreground hover:bg-muted"
                                >
                                  <Pencil className="h-3 w-3" aria-hidden />
                                  Edit
                                </Link>
                                {survey.source === 'jotform' && survey.jotformFormUrl ? (
                                  <a
                                    href={survey.jotformFormUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex items-center gap-1 rounded-[6px] border border-border bg-card px-2 py-1 text-xs font-semibold text-foreground hover:bg-muted"
                                  >
                                    <ExternalLink className="h-3 w-3" aria-hidden />
                                    Jotform
                                  </a>
                                ) : (
                                  <Link
                                    to={`/app/surveys/${survey.id}`}
                                    className="inline-flex items-center gap-1 rounded-[6px] border border-border bg-card px-2 py-1 text-xs font-semibold text-foreground hover:bg-muted"
                                  >
                                    Learner link
                                  </Link>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : null}

              {legacyForms.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Legacy program form URLs
                  </p>
                  <ul className="space-y-2">
                    {legacyForms.map((form) => (
                      <li
                        key={`${form.kind}-${form.url}`}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-muted/20 px-3 py-2.5 text-sm"
                      >
                        <div className="min-w-0">
                          <p className="font-medium text-foreground">{form.label}</p>
                          <p className="truncate text-xs text-muted-foreground">{form.url}</p>
                        </div>
                        <a
                          href={form.url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex shrink-0 items-center gap-1 rounded-[6px] border border-border bg-card px-2 py-1 text-xs font-semibold text-foreground hover:bg-muted"
                        >
                          <ExternalLink className="h-3 w-3" aria-hidden />
                          Open
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </>
          )}
        </div>
      )}
    </ZoomSectionCard>
  );
}
