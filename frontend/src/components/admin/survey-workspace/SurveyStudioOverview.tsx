import type { ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import {
  BarChart3,
  ClipboardList,
  ExternalLink,
  Eye,
  FileText,
  GitCompare,
  Percent,
  Settings2,
  Users,
} from 'lucide-react';
import { Link } from 'react-router-dom';

import { adminApi } from '../../../api/admin';
import type { Survey } from '../../../api/surveys';
import { SurveyKpiStrip } from './SurveyKpiStrip';
import { SurveyKpiTile } from './SurveyKpiTile';
import { SurveyStatusPill } from './SurveyStatusPill';
import type { SurveyStudioTab } from './SurveyStudioTabs';

function surveyTypeLabel(type: string): string {
  if (type === 'INTAKE') return 'Registration';
  if (type === 'FEEDBACK') return 'Post-event';
  return type.replace(/_/g, ' ');
}

function formatWhen(value: string | null | undefined): string {
  if (!value) return '—';
  try {
    return format(parseISO(value), 'MMM d, yyyy · h:mm a');
  } catch {
    return '—';
  }
}

function QuickAction({
  label,
  hint,
  onClick,
  icon,
}: {
  label: string;
  hint: string;
  onClick: () => void;
  icon: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex w-full items-center gap-3 rounded-[6px] border border-border bg-card px-3 py-2.5 text-left transition-colors hover:border-brand-200 hover:bg-brand-50/40 dark:hover:bg-brand-950/20"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground group-hover:bg-brand-100 group-hover:text-brand-800 dark:group-hover:bg-brand-900/40 dark:group-hover:text-brand-100">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-foreground">{label}</span>
        <span className="block text-xs text-muted-foreground">{hint}</span>
      </span>
    </button>
  );
}

export function SurveyStudioOverview({
  survey,
  responseCount,
  lastResponseAt,
  onOpenTab,
}: {
  survey: Survey;
  responseCount: number;
  lastResponseAt?: string | null;
  onOpenTab: (tab: SurveyStudioTab) => void;
}) {
  const { data: analytics } = useQuery({
    // Separate from Results-tab key (which may include samples).
    queryKey: ['admin', 'survey', survey.id, 'analytics', 'overview'],
    queryFn: () =>
      adminApi.getSurveyAnalytics(survey.id, { includeSamples: false }),
    staleTime: 60_000,
  });

  const totals = analytics?.analytics.totals;
  const completion = totals?.completionRate;
  const completionValue =
    completion && completion.eligible > 0
      ? `${Math.round(completion.rate)}%`
      : survey.type === 'INTAKE'
        ? 'N/A'
        : '—';
  const completionHint = completion
    ? `${completion.completed.toLocaleString()} of ${completion.eligible.toLocaleString()} eligible`
    : survey.type === 'INTAKE'
      ? 'Not tracked for registration surveys'
      : 'Available after responses';

  const resolvedLastResponse =
    lastResponseAt ?? totals?.lastResponseAt ?? null;

  return (
    <div className="space-y-5" data-testid="survey-studio-overview">
      <SurveyKpiStrip className="lg:grid-cols-4">
        <SurveyKpiTile
          label="Responses"
          value={responseCount.toLocaleString()}
          hint={
            resolvedLastResponse
              ? `Last ${formatWhen(resolvedLastResponse)}`
              : 'No submissions yet'
          }
          icon={<Users className="h-4 w-4" aria-hidden />}
          tone="brand"
        />
        <SurveyKpiTile
          label="Completion"
          value={completionValue}
          hint={completionHint}
          icon={<Percent className="h-4 w-4" aria-hidden />}
          tone="cyan"
        />
        <SurveyKpiTile
          label="Schema"
          value={`v${survey.schemaVersion ?? 1}`}
          hint={
            survey.isCustomized
              ? 'Customized — template ensure leaves this alone'
              : 'Matches platform template'
          }
          icon={<FileText className="h-4 w-4" aria-hidden />}
          tone="slate"
        />
        <SurveyKpiTile
          label="Type"
          value={surveyTypeLabel(survey.type)}
          hint={survey.required ? 'Required for participants' : 'Optional'}
          icon={<ClipboardList className="h-4 w-4" aria-hidden />}
          tone="amber"
        />
      </SurveyKpiStrip>

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="space-y-4 rounded-card border border-border bg-card p-5 shadow-card lg:col-span-2">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-semibold text-foreground">This survey</h2>
            {survey.isCustomized ? (
              <SurveyStatusPill kind="customized">Customized</SurveyStatusPill>
            ) : (
              <SurveyStatusPill kind="ready">Template</SurveyStatusPill>
            )}
            {survey.jotformFormId ? (
              <SurveyStatusPill kind="jotform">Jotform linked</SurveyStatusPill>
            ) : (
              <SurveyStatusPill kind="native">Native</SurveyStatusPill>
            )}
          </div>

          {survey.description ? (
            <p className="text-sm leading-relaxed text-muted-foreground">
              {survey.description}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              No description yet. Add one under Settings so admins know the intent of this form.
            </p>
          )}

          <dl className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-[6px] border border-border bg-muted/30 px-3 py-2.5">
              <dt className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                Updated
              </dt>
              <dd className="mt-1 text-sm text-foreground">
                {formatWhen(survey.updatedAt)}
              </dd>
            </div>
            <div className="rounded-[6px] border border-border bg-muted/30 px-3 py-2.5">
              <dt className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                Created
              </dt>
              <dd className="mt-1 text-sm text-foreground">
                {formatWhen(survey.createdAt)}
              </dd>
            </div>
          </dl>

          {survey.program ? (
            <div className="rounded-[6px] border border-brand-100 bg-gradient-to-br from-brand-50/80 via-white to-white p-4 dark:border-brand-900/40 dark:from-brand-950/30 dark:via-zinc-900 dark:to-zinc-950">
              <p className="text-[11px] font-bold uppercase tracking-wide text-brand-800 dark:text-brand-200">
                Linked webinar
              </p>
              <p className="mt-1 text-base font-semibold text-foreground">
                {survey.program.title}
              </p>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                {survey.program.sponsorName ? (
                  <span>Sponsor · {survey.program.sponsorName}</span>
                ) : null}
                {survey.program.startDate ? (
                  <span>Starts · {formatWhen(survey.program.startDate)}</span>
                ) : null}
              </div>
              <Link
                to={`/admin/programs/${survey.program.id}/hub?tab=surveys`}
                className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-800 underline-offset-2 hover:underline dark:text-brand-200"
              >
                Open program hub
                <ExternalLink className="h-3.5 w-3.5" aria-hidden />
              </Link>
            </div>
          ) : (
            <div className="rounded-[6px] border border-dashed border-border bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
              Not linked to a webinar. Attach this survey from a program hub when ready.
            </div>
          )}
        </section>

        <section className="space-y-2 rounded-card border border-border bg-card p-5 shadow-card">
          <h2 className="text-sm font-semibold text-foreground">Quick actions</h2>
          <p className="pb-1 text-xs text-muted-foreground">
            Jump without leaving the studio.
          </p>
          <QuickAction
            label="View results"
            hint="Charts, ease, NPS"
            icon={<BarChart3 className="h-4 w-4" aria-hidden />}
            onClick={() => onOpenTab('results')}
          />
          <QuickAction
            label="Review responses"
            hint={`${responseCount.toLocaleString()} row${responseCount === 1 ? '' : 's'}`}
            icon={<ClipboardList className="h-4 w-4" aria-hidden />}
            onClick={() => onOpenTab('responses')}
          />
          <QuickAction
            label="Open preview"
            hint="Desktop / mobile · no submit"
            icon={<Eye className="h-4 w-4" aria-hidden />}
            onClick={() => onOpenTab('preview')}
          />
          <QuickAction
            label="Edit questions"
            hint="History-safe when responses exist"
            icon={<FileText className="h-4 w-4" aria-hidden />}
            onClick={() => onOpenTab('questions')}
          />
          <QuickAction
            label="Settings"
            hint="Title, type, description"
            icon={<Settings2 className="h-4 w-4" aria-hidden />}
            onClick={() => onOpenTab('settings')}
          />
          {survey.type === 'FEEDBACK' ? (
            <Link
              to={`/admin/surveys/compare?ids=${encodeURIComponent(survey.id)}`}
              className="group flex w-full items-center gap-3 rounded-[6px] border border-border bg-card px-3 py-2.5 text-left transition-colors hover:border-brand-200 hover:bg-brand-50/40 dark:hover:bg-brand-950/20"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground group-hover:bg-brand-100 group-hover:text-brand-800 dark:group-hover:bg-brand-900/40 dark:group-hover:text-brand-100">
                <GitCompare className="h-4 w-4" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-foreground">
                  Compare webinars
                </span>
                <span className="block text-xs text-muted-foreground">
                  Side-by-side ease / NPS
                </span>
              </span>
            </Link>
          ) : null}
        </section>
      </div>
    </div>
  );
}
