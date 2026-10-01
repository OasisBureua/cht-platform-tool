import { useState, type ChangeEvent, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  Check,
  CheckCircle2,
  FileText,
  Link2,
  Upload,
  XCircle,
} from 'lucide-react';
import { getApiErrorMessage } from '../../../api/client';
import {
  Button,
  ZoomAlert,
  ZoomBackLink,
  ZoomSectionCard,
  ZoomStatusBadge,
} from '../../../components/admin/zoom-recordings/ZoomRecordingsUi';
import { Field } from '../../../components/ui';
import { cn } from '../../../lib/cn';
import { ToggleChip } from './components/ToggleChip';
import { useToast } from './components/Toaster';
import {
  useCreateCampaign,
  useConnectFeedbackSurvey,
  useDataValidation,
  useFeedbackSurveys,
  useHubspotStatus,
  useUpdateCampaign,
  useUploadCsv,
} from './lib/hooks';
import { PLATFORM_LABELS } from './lib/types';
import type { Platform, ReportType } from './lib/types';

const SELECT_CLS =
  'h-12 w-full min-w-0 rounded-[6px] bg-card px-4 text-base text-foreground shadow-card outline-none sm:text-sm ' +
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ' +
  'disabled:cursor-not-allowed disabled:opacity-50';

const STEPS = ['Report type', 'Campaign details', 'Data connection', 'Validation'];
const PLATFORMS: Platform[] = ['linkedin', 'meta', 'youtube', 'livestream', 'survey'];

const PLATFORM_UPLOAD_DESCRIPTIONS: Record<Platform, string> = {
  linkedin: 'Campaign Manager export: impressions, video views, dwell time, completions',
  meta: 'Ads Manager export: impressions, reach, link clicks, CTR, demographics',
  youtube: 'Studio Analytics export: views, watch time, CTR, engaged views',
  livestream: 'Event platform export: registrations, attendees, HCP verification rate',
  survey: 'CHT post-event feedback: responses, practice-change intent, confidence lift',
};

interface FormState {
  name: string;
  programName: string;
  clientSponsor: string;
  diseaseState: string;
  treatmentTopic: string;
  createdBy: string;
  reportingPeriodStart: string;
  reportingPeriodEnd: string;
  targetAudience: string;
  targetRegions: string;
  targetInstitutions: string;
  physicianSpeakers: string;
  landingPageUrl: string;
  hubspotCampaignId: string;
  eventDate: string;
  livestreamUrl: string;
}

const EMPTY_FORM: FormState = {
  name: '', programName: '', clientSponsor: '', diseaseState: '', treatmentTopic: '', createdBy: '',
  reportingPeriodStart: '', reportingPeriodEnd: '', targetAudience: '', targetRegions: '',
  targetInstitutions: '', physicianSpeakers: '', landingPageUrl: '', hubspotCampaignId: '',
  eventDate: '', livestreamUrl: '',
};

const REPORT_TYPES: Array<{
  value: ReportType;
  title: string;
  body: string;
  icon: typeof BarChart3;
}> = [
  {
    value: 'analytics',
    title: 'Analytics report',
    body:
      'Metric-heavy report with platform breakdowns, KPI tiles, a cross-channel snapshot, validation status and a glossary. Best for internal review and data-rich client deliverables.',
    icon: BarChart3,
  },
  {
    value: 'executive',
    title: 'Executive report (PDF)',
    body:
      'Client-ready executive summary printed as a PDF. Pick sources and a 30, 60 or 90-day window, follow progress, then download. Best for executive presentations.',
    icon: FileText,
  },
];

function Stepper({ step }: { step: number }) {
  return (
    <ol className="flex items-center" aria-label="Progress">
      {STEPS.map((label, i) => {
        const n = i + 1;
        const done = n < step;
        const current = n === step;
        return (
          <li key={label} className="flex flex-1 items-center last:flex-none">
            <div className="flex items-center gap-2" aria-current={current ? 'step' : undefined}>
              <span
                className={cn(
                  'grid size-7 shrink-0 place-items-center rounded-full text-xs font-semibold transition-colors',
                  done
                    ? 'bg-brand-600 text-white'
                    : current
                      ? 'bg-foreground text-background'
                      : 'bg-muted text-muted-foreground',
                )}
              >
                {done ? <Check className="h-3.5 w-3.5" aria-hidden /> : n}
              </span>
              <span
                className={cn(
                  'hidden text-sm sm:block',
                  current ? 'font-medium text-foreground' : 'text-muted-foreground',
                )}
              >
                {label}
              </span>
            </div>
            {n < STEPS.length ? (
              <span
                aria-hidden
                className={cn('mx-3 h-0.5 flex-1 rounded-full', done ? 'bg-brand-600' : 'bg-border')}
              />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}

function FieldGrid({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-1 gap-5 md:grid-cols-2">{children}</div>;
}

function StepActions({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap justify-end gap-2">{children}</div>;
}

export default function NewReport() {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [step, setStep] = useState(1);
  const [reportType, setReportType] = useState<ReportType>('analytics');
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [campaignId, setCampaignId] = useState<number | null>(null);
  const [uploads, setUploads] = useState<Partial<Record<Platform, string>>>({});
  const [selectedSurveyId, setSelectedSurveyId] = useState('');

  const set = (key: keyof FormState) => (e: ChangeEvent<HTMLInputElement>) =>
    setForm((prev) => ({ ...prev, [key]: e.target.value }));

  const togglePlatform = (p: Platform) =>
    setPlatforms((prev) => (prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]));

  const { data: hubspotStatus } = useHubspotStatus(step === 3);
  const { data: feedbackSurveys = [], isLoading: feedbackSurveysLoading } =
    useFeedbackSurveys(step === 3);
  const { data: validation } = useDataValidation(campaignId ?? 0, step === 4 && campaignId != null);

  const createCampaign = useCreateCampaign();
  const updateCampaign = useUpdateCampaign(campaignId ?? 0);
  const uploadCsv = useUploadCsv(campaignId ?? 0);
  const connectFeedbackSurvey = useConnectFeedbackSurvey(campaignId ?? 0);

  const saveCampaign = () => {
    const body = { ...form, reportType, platforms, status: 'draft' as const };
    const onSuccess = (campaign: { id: number }) => {
      setCampaignId(campaign.id);
      setStep(3);
    };
    const onError = (error: unknown) =>
      toast({
        title: 'Failed to save campaign',
        description: getApiErrorMessage(error, 'Failed to save campaign.'),
        variant: 'destructive',
      });

    if (campaignId) {
      updateCampaign.mutate(body, { onSuccess, onError });
    } else {
      createCampaign.mutate(body, { onSuccess, onError });
    }
  };

  const handleFileChange = (platform: Platform) => (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && campaignId != null) {
      void file.text().then((content) => {
        uploadCsv.mutate(
          { platform, filename: file.name, content },
          {
            onSuccess: () => {
              setUploads((prev) => ({ ...prev, [platform]: file.name }));
              toast({ title: `${PLATFORM_LABELS[platform]} CSV uploaded`, description: file.name });
            },
            onError: (error: Error) =>
              toast({ title: 'Upload failed', description: error.message, variant: 'destructive' }),
          },
        );
      });
    }
    e.target.value = '';
  };

  const connectSelectedSurvey = () => {
    const survey = feedbackSurveys.find((item) => item.id === selectedSurveyId);
    if (!survey || campaignId == null) return;
    connectFeedbackSurvey.mutate(survey, {
      onSuccess: (connected) => {
        setUploads((prev) => ({ ...prev, survey: connected.filename }));
        toast({
          title: 'Feedback survey connected',
          description: `${connected.rowCount} response${connected.rowCount === 1 ? '' : 's'} available for reporting.`,
        });
      },
      onError: (error: Error) =>
        toast({
          title: 'Could not connect survey',
          description: error.message,
          variant: 'destructive',
        }),
    });
  };

  const finish = () => {
    if (campaignId == null) return;
    navigate(
      reportType === 'analytics'
        ? `/admin/reports/campaigns/${campaignId}/report`
        : `/admin/reports/campaigns/${campaignId}?tab=reports`,
    );
  };

  const saving = createCampaign.isPending || updateCampaign.isPending;

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 p-4 md:p-6">
      {step === 1 ? (
        <ZoomBackLink to="/admin/reports">
          <ArrowLeft className="h-4 w-4" aria-hidden />
          All campaigns
        </ZoomBackLink>
      ) : (
        <button
          type="button"
          onClick={() => setStep(step - 1)}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Back
        </button>
      )}

      <header className="space-y-5 rounded-card bg-card p-5 shadow-card md:p-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Create report</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Set up a campaign, connect its data, then generate a report.
          </p>
        </div>
        <Stepper step={step} />
      </header>

      {step === 1 && (
        <>
          <ZoomSectionCard title="Report type" description="Choose the type of report you want to create.">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2" role="radiogroup" aria-label="Report type">
              {REPORT_TYPES.map(({ value, title, body, icon: Icon }) => {
                const on = reportType === value;
                return (
                  <button
                    key={value}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => setReportType(value)}
                    className={cn(
                      'rounded-card p-5 text-left shadow-card transition-[background-color,box-shadow] duration-150',
                      'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
                      on ? 'bg-brand-600/5 ring-2 ring-brand-600' : 'bg-card hover:shadow-card-hover',
                    )}
                  >
                    <span
                      className={cn(
                        'grid size-10 place-items-center rounded-[6px]',
                        on ? 'bg-brand-600 text-white' : 'bg-muted text-muted-foreground',
                      )}
                    >
                      <Icon className="h-5 w-5" aria-hidden />
                    </span>
                    <span className="mt-4 block font-semibold text-foreground">{title}</span>
                    <span className="mt-1 block text-sm leading-relaxed text-muted-foreground">{body}</span>
                  </button>
                );
              })}
            </div>
          </ZoomSectionCard>
          <StepActions>
            <Button size="sm" onClick={() => setStep(2)}>
              Continue <ArrowRight className="h-4 w-4" />
            </Button>
          </StepActions>
        </>
      )}

      {step === 2 && (
        <>
          <ZoomSectionCard title="Report identity">
            <FieldGrid>
              <Field
                className="md:col-span-2"
                label="Report title (required)"
                placeholder="e.g., Q3 2026 HCP Oncology Campaign Report"
                value={form.name}
                onChange={set('name')}
                required
              />
              <Field label="Program name" placeholder="e.g., OncoPrecision Initiative" value={form.programName} onChange={set('programName')} />
              <Field label="Client / sponsor" placeholder="e.g., Pharma Co." autoComplete="off" value={form.clientSponsor} onChange={set('clientSponsor')} />
              <Field label="Disease state" placeholder="e.g., Non-Small Cell Lung Cancer" value={form.diseaseState} onChange={set('diseaseState')} />
              <Field label="Treatment topic" placeholder="e.g., First-line immunotherapy selection" value={form.treatmentTopic} onChange={set('treatmentTopic')} />
              <Field label="Created by" placeholder="e.g., Jane Smith" value={form.createdBy} onChange={set('createdBy')} />
            </FieldGrid>
          </ZoomSectionCard>

          <ZoomSectionCard title="Reporting period">
            <FieldGrid>
              <Field label="Period start" type="date" value={form.reportingPeriodStart} onChange={set('reportingPeriodStart')} />
              <Field label="Period end" type="date" value={form.reportingPeriodEnd} onChange={set('reportingPeriodEnd')} />
            </FieldGrid>
          </ZoomSectionCard>

          <ZoomSectionCard title="Platforms" description="Select all platforms included in this campaign.">
            <div className="flex flex-wrap gap-2" role="group" aria-label="Platforms">
              {PLATFORMS.map((p) => (
                <ToggleChip key={p} on={platforms.includes(p)} onClick={() => togglePlatform(p)}>
                  {PLATFORM_LABELS[p]}
                </ToggleChip>
              ))}
            </div>
          </ZoomSectionCard>

          <ZoomSectionCard title="Audience">
            <FieldGrid>
              <Field label="Target audience" placeholder="e.g., Oncologists, PCP, NP/PA" value={form.targetAudience} onChange={set('targetAudience')} />
              <Field label="Target regions" placeholder="e.g., Northeast, Midwest US" value={form.targetRegions} onChange={set('targetRegions')} />
              <Field className="md:col-span-2" label="Target institutions" placeholder="e.g., Academic medical centers, community oncology" value={form.targetInstitutions} onChange={set('targetInstitutions')} />
              <Field className="md:col-span-2" label="Physician speakers / KOLs" placeholder="e.g., Dr. Jane Smith (MD, FACP)" value={form.physicianSpeakers} onChange={set('physicianSpeakers')} />
            </FieldGrid>
          </ZoomSectionCard>

          <ZoomSectionCard title="Technical configuration">
            <FieldGrid>
              <Field className="md:col-span-2" label="Landing page URL" type="url" placeholder="https://..." value={form.landingPageUrl} onChange={set('landingPageUrl')} />
              <Field label="HubSpot campaign ID" placeholder="From the HubSpot campaign URL" value={form.hubspotCampaignId} onChange={set('hubspotCampaignId')} />
              <Field label="Event date" type="date" value={form.eventDate} onChange={set('eventDate')} />
              <Field className="md:col-span-2" label="Livestream URL" type="url" placeholder="https://..." value={form.livestreamUrl} onChange={set('livestreamUrl')} />
            </FieldGrid>
          </ZoomSectionCard>

          <StepActions>
            <Button size="sm" variant="outline" onClick={() => setStep(1)}>
              Back
            </Button>
            <Button size="sm" disabled={!form.name.trim() || saving} onClick={saveCampaign}>
              {saving ? 'Saving…' : 'Continue'} <ArrowRight className="h-4 w-4" />
            </Button>
          </StepActions>
        </>
      )}

      {step === 3 && (
        <>
          <ZoomSectionCard
            title="HubSpot CRM"
            description="HubSpot is optional."
            action={
              hubspotStatus?.connected ? (
                <ZoomStatusBadge tone="success" icon={CheckCircle2}>Connected</ZoomStatusBadge>
              ) : (
                <ZoomStatusBadge tone="neutral">Not connected</ZoomStatusBadge>
              )
            }
          >
            {!hubspotStatus?.connected ? (
              <p className="text-sm text-muted-foreground">
                Add HUBSPOT_ACCESS_TOKEN to environment secrets to enable CRM sync.
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">CRM data syncs automatically for this campaign.</p>
            )}
          </ZoomSectionCard>

          <ZoomSectionCard
            title="Reporting data sources"
            description="Connect a CHT post-event feedback survey. External platform CSVs can be uploaded here or later from the campaign."
          >
            <ul className="divide-y divide-border">
              {PLATFORMS.map((p) => {
                const selected = platforms.includes(p);
                const uploadedFile = uploads[p];
                return (
                  <li key={p} className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium text-foreground">{PLATFORM_LABELS[p]}</span>
                        {uploadedFile ? (
                          <ZoomStatusBadge tone="success" icon={CheckCircle2}>
                            {uploadedFile}
                          </ZoomStatusBadge>
                        ) : !selected ? (
                          <span className="text-xs text-muted-foreground">Not selected</span>
                        ) : null}
                      </div>
                      <p className="mt-0.5 text-sm text-muted-foreground">{PLATFORM_UPLOAD_DESCRIPTIONS[p]}</p>
                    </div>
                    {p === 'survey' ? (
                      <div className="flex w-full flex-col gap-2 sm:max-w-md sm:flex-row">
                        <select
                          value={selectedSurveyId}
                          onChange={(event) => setSelectedSurveyId(event.target.value)}
                          disabled={!selected || feedbackSurveysLoading}
                          className={SELECT_CLS}
                          aria-label="Feedback survey responses"
                        >
                          <option value="">
                            {feedbackSurveysLoading
                              ? 'Loading feedback surveys…'
                              : feedbackSurveys.length === 0
                                ? 'No feedback surveys available'
                                : 'Select program feedback responses'}
                          </option>
                          {feedbackSurveys.map((survey) => (
                            <option key={survey.id} value={survey.id}>
                              {survey.program?.title ?? 'Program'}: {survey.title} ({survey.responseCount ?? 0}{' '}
                              responses)
                            </option>
                          ))}
                        </select>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-12"
                          onClick={connectSelectedSurvey}
                          disabled={!selectedSurveyId || !selected || connectFeedbackSurvey.isPending}
                        >
                          {connectFeedbackSurvey.isPending ? 'Connecting…' : 'Use responses'}
                        </Button>
                      </div>
                    ) : (
                      <label
                        className={cn(
                          'inline-flex h-9 shrink-0 cursor-pointer items-center gap-2 rounded-[6px] bg-card px-3.5 text-sm font-medium text-foreground shadow-card',
                          'transition-[background-color,box-shadow] duration-150 hover:bg-muted hover:shadow-card-hover',
                          'focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-ring',
                        )}
                      >
                        <input accept=".csv" className="sr-only" type="file" onChange={handleFileChange(p)} />
                        <Upload className="h-4 w-4" aria-hidden />
                        {uploadedFile ? 'Replace CSV' : 'Upload CSV'}
                      </label>
                    )}
                  </li>
                );
              })}
            </ul>
          </ZoomSectionCard>

          <StepActions>
            <Button size="sm" variant="outline" onClick={() => setStep(2)}>
              Back
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setStep(4)}>
              Skip
            </Button>
            <Button size="sm" onClick={() => setStep(4)}>
              Continue <ArrowRight className="h-4 w-4" />
            </Button>
          </StepActions>
        </>
      )}

      {step === 4 && (
        <>
          <ZoomSectionCard
            title="Validation"
            description="Review data availability before generating. Missing sections show clear warnings in the report."
          >
            {(validation?.dataSourcesSummary ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">Checking data sources…</p>
            ) : (
              <ul className="space-y-3">
                {(validation?.dataSourcesSummary ?? []).map((source) => {
                  const available = source.status === 'available';
                  return (
                    <li key={source.source} className="rounded-[6px] bg-muted/40 px-4 py-3">
                      <div className="flex items-center gap-3">
                        {available ? (
                          <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" aria-hidden />
                        ) : (
                          <XCircle className="h-4 w-4 text-destructive" aria-hidden />
                        )}
                        <span className="text-sm font-medium text-foreground">{source.source}</span>
                        <span className="ml-auto">
                          {available ? (
                            <ZoomStatusBadge tone="success">Ready</ZoomStatusBadge>
                          ) : (
                            <ZoomStatusBadge tone="error">Missing</ZoomStatusBadge>
                          )}
                        </span>
                      </div>
                      {!available && source.metricsMissing.length > 0 ? (
                        <p className="mt-2 pl-7 text-sm text-muted-foreground">
                          Missing {source.metricsMissing.join(', ')}.{' '}
                          {source.source === 'Survey'
                            ? 'Select a CHT program feedback survey to include these metrics.'
                            : `Upload the ${source.source} CSV export to include these metrics.`}
                        </p>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )}
          </ZoomSectionCard>

          {reportType === 'executive' ? (
            <ZoomAlert tone="info" title="Next: generate the PDF">
              Executive reports are generated from the campaign&apos;s Reports tab. Link the Platform programs
              first so Zoom sessions, attendance and surveys are included.
            </ZoomAlert>
          ) : null}

          <StepActions>
            <Button size="sm" variant="outline" onClick={() => setStep(3)}>
              Back
            </Button>
            {reportType === 'executive' && campaignId != null ? (
              <Button
                size="sm"
                variant="outline"
                to={`/admin/reports/campaigns/${campaignId}?tab=programs`}
              >
                <Link2 className="h-4 w-4" />
                Link programs
              </Button>
            ) : null}
            <Button size="sm" onClick={finish}>
              {reportType === 'executive' ? 'Go to reports' : 'Generate report'}
              <ArrowRight className="h-4 w-4" />
            </Button>
          </StepActions>
        </>
      )}
    </div>
  );
}
