import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Check, Presentation, Upload } from 'lucide-react';
import ChromeContainer from './components/ChromeContainer';
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
import { cn } from './lib/utils';
import { PLATFORM_LABELS } from './lib/types';
import type { Platform, ReportType } from './lib/types';

const INPUT_CLS =
  'flex h-9 w-full rounded-lg border border-border bg-background px-3 py-1 text-sm text-foreground shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary';

const LABEL_CLS = 'mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted-foreground';

const BTN_PRIMARY =
  'inline-flex min-h-9 items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-primary bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary-hover disabled:pointer-events-none disabled:opacity-50';

const BTN_OUTLINE =
  'inline-flex min-h-9 items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:pointer-events-none disabled:opacity-50';

const STEPS = ['Report Type', 'Campaign Details', 'Data Connection', 'Validation'];
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

/* lucide chart-no-axes-column: transcribed verbatim (not in the installed lucide version). */
function ChartNoAxesColumnIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      className={className} aria-hidden="true">
      <path d="M5 21v-6" /><path d="M12 21V3" /><path d="M19 21V9" />
    </svg>
  );
}

function CircleXIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="10" /><path d="m15 9-6 6" /><path d="m9 9 6 6" />
    </svg>
  );
}

function CircleCheckIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="10" /><path d="m9 12 2 2 4-4" />
    </svg>
  );
}

function StepIndicator({ step }: { step: number }) {
  return (
    <div className="flex items-center gap-0">
      {STEPS.map((label, i) => {
        const n = i + 1;
        const done = n < step;
        const current = n === step;
        return (
          <div key={label} className="flex flex-1 items-center">
            <div className="flex items-center gap-2">
              <div
                className={cn(
                  'flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition-all',
                  done
                    ? 'bg-primary text-primary-foreground'
                    : current
                      ? 'bg-foreground text-background'
                      : 'bg-muted text-muted-foreground',
                )}
              >
                {done ? <Check className="h-3.5 w-3.5" /> : n}
              </div>
              <span className={cn('hidden text-xs font-medium sm:block', current ? 'text-foreground' : 'text-muted-foreground')}>
                {label}
              </span>
            </div>
            {n < STEPS.length && <div className={cn('mx-3 h-0.5 flex-1', done ? 'bg-primary' : 'bg-border')} />}
          </div>
        );
      })}
    </div>
  );
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="border-b border-border bg-muted px-6 py-3">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-foreground">{title}</h2>
      </div>
      {children}
    </div>
  );
}

function Field({
  label,
  required,
  full,
  children,
}: {
  label: string;
  required?: boolean;
  full?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={full ? 'md:col-span-2' : ''}>
      <label className={LABEL_CLS}>
        {label}
        {required && <span className="ml-0.5 text-accent">*</span>}
      </label>
      {children}
    </div>
  );
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

  const set = (key: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement>) =>
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
    const onError = (error: Error) =>
      toast({ title: 'Failed to save campaign', description: error.message, variant: 'destructive' });

    if (campaignId) {
      updateCampaign.mutate(body, { onSuccess, onError });
    } else {
      createCampaign.mutate(body, { onSuccess, onError });
    }
  };

  const handleFileChange = (platform: Platform) => (e: React.ChangeEvent<HTMLInputElement>) => {
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

  const generateReport = () => {
    if (campaignId == null) return;
    navigate(
      reportType === 'analytics'
        ? `/admin/content-hub/campaigns/${campaignId}/report`
        : `/admin/content-hub/campaigns/${campaignId}/executive-report`,
    );
  };

  const saving = createCampaign.isPending || updateCampaign.isPending;

  return (
    <ChromeContainer>
      <div className="mx-auto w-full max-w-4xl">
        {step === 1 ? (
          <Link
            to="/admin/content-hub"
            className="mb-6 flex items-center gap-2 text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="text-sm">All Reports</span>
          </Link>
        ) : (
          <button
            onClick={() => setStep(step - 1)}
            className="mb-6 flex items-center gap-2 text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="text-sm">Back</span>
          </button>
        )}

        <div className="mb-8">
          <h1 className="mb-4 text-2xl font-bold text-foreground">Create Report</h1>
          <StepIndicator step={step} />
        </div>

        {step === 1 && (
          <div className="space-y-4">
            <p className="mb-6 text-sm text-muted-foreground">Choose the type of report you want to create.</p>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <button
                onClick={() => setReportType('analytics')}
                className={cn(
                  'rounded-xl border-2 p-6 text-left transition-all',
                  reportType === 'analytics' ? 'border-primary bg-primary/5' : 'border-border bg-card hover:border-primary/40',
                )}
              >
                <div className={cn('mb-4 flex h-10 w-10 items-center justify-center rounded-lg', reportType === 'analytics' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground')}>
                  <ChartNoAxesColumnIcon className="h-5 w-5" />
                </div>
                <h3 className="mb-1 font-semibold text-foreground">Analytics Report</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  Detailed, metric-heavy report with full platform breakdowns, KPI tiles, cross-channel snapshot,
                  validation status, and glossary. Best for internal review and data-rich client deliverables.
                </p>
              </button>
              <button
                onClick={() => setReportType('executive')}
                className={cn(
                  'rounded-xl border-2 p-6 text-left transition-all',
                  reportType === 'executive' ? 'border-primary bg-primary/5' : 'border-border bg-card hover:border-primary/40',
                )}
              >
                <div className={cn('mb-4 flex h-10 w-10 items-center justify-center rounded-lg', reportType === 'executive' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground')}>
                  <Presentation className="h-5 w-5" />
                </div>
                <h3 className="mb-1 font-semibold text-foreground">Executive Report Deck</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  Visual, client-facing slide deck with large KPI tiles, campaign story, geo-targeting, platform
                  highlights, and concise strategic narrative. Best for executive presentations.
                </p>
              </button>
            </div>
            <div className="flex justify-end pt-4">
              <button className={BTN_PRIMARY} onClick={() => setStep(2)}>
                Continue <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-5">
            <SectionCard title="Report Identity">
              <div className="grid grid-cols-1 gap-5 p-6 md:grid-cols-2">
                <Field label="Report Title" required full>
                  <input className={INPUT_CLS} placeholder="e.g., Q3 2026 HCP Oncology Campaign Report" value={form.name} onChange={set('name')} />
                </Field>
                <Field label="Program Name">
                  <input className={INPUT_CLS} placeholder="e.g., OncoPrecision Initiative" value={form.programName} onChange={set('programName')} />
                </Field>
                <Field label="Client / Sponsor">
                  <input className={INPUT_CLS} placeholder="e.g., Pharma Co." autoComplete="off" value={form.clientSponsor} onChange={set('clientSponsor')} />
                </Field>
                <Field label="Disease State">
                  <input className={INPUT_CLS} placeholder="e.g., Non-Small Cell Lung Cancer" value={form.diseaseState} onChange={set('diseaseState')} />
                </Field>
                <Field label="Treatment Topic">
                  <input className={INPUT_CLS} placeholder="e.g., First-line immunotherapy selection" value={form.treatmentTopic} onChange={set('treatmentTopic')} />
                </Field>
                <Field label="Created By">
                  <input className={INPUT_CLS} placeholder="e.g., Jane Smith" value={form.createdBy} onChange={set('createdBy')} />
                </Field>
              </div>
            </SectionCard>

            <SectionCard title="Reporting Period">
              <div className="grid grid-cols-1 gap-5 p-6 md:grid-cols-2">
                <Field label="Period Start">
                  <input className={INPUT_CLS} type="date" value={form.reportingPeriodStart} onChange={set('reportingPeriodStart')} />
                </Field>
                <Field label="Period End">
                  <input className={INPUT_CLS} type="date" value={form.reportingPeriodEnd} onChange={set('reportingPeriodEnd')} />
                </Field>
              </div>
            </SectionCard>

            <SectionCard title="Platforms">
              <div className="p-6">
                <p className="mb-4 text-xs text-muted-foreground">Select all platforms included in this campaign.</p>
                <div className="flex flex-wrap gap-3">
                  {PLATFORMS.map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => togglePlatform(p)}
                      className={cn(
                        'rounded-lg border-2 px-4 py-2 text-sm font-medium transition-all',
                        platforms.includes(p)
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'border-border text-muted-foreground hover:border-muted-foreground',
                      )}
                    >
                      {PLATFORM_LABELS[p]}
                    </button>
                  ))}
                </div>
              </div>
            </SectionCard>

            <SectionCard title="Audience">
              <div className="grid grid-cols-1 gap-5 p-6 md:grid-cols-2">
                <Field label="Target Audience">
                  <input className={INPUT_CLS} placeholder="e.g., Oncologists, PCP, NP/PA" value={form.targetAudience} onChange={set('targetAudience')} />
                </Field>
                <Field label="Target Regions">
                  <input className={INPUT_CLS} placeholder="e.g., Northeast, Midwest US" value={form.targetRegions} onChange={set('targetRegions')} />
                </Field>
                <Field label="Target Institutions" full>
                  <input className={INPUT_CLS} placeholder="e.g., Academic medical centers, community oncology" value={form.targetInstitutions} onChange={set('targetInstitutions')} />
                </Field>
                <Field label="Physician Speakers / KOLs" full>
                  <input className={INPUT_CLS} placeholder="e.g., Dr. Jane Smith (MD, FACP)" value={form.physicianSpeakers} onChange={set('physicianSpeakers')} />
                </Field>
              </div>
            </SectionCard>

            <SectionCard title="Technical Configuration">
              <div className="grid grid-cols-1 gap-5 p-6 md:grid-cols-2">
                <Field label="Landing Page URL" full>
                  <input className={INPUT_CLS} placeholder="https://..." type="url" value={form.landingPageUrl} onChange={set('landingPageUrl')} />
                </Field>
                <Field label="HubSpot Campaign ID">
                  <input className={INPUT_CLS} placeholder="From HubSpot campaign URL" value={form.hubspotCampaignId} onChange={set('hubspotCampaignId')} />
                </Field>
                <Field label="Event Date">
                  <input className={INPUT_CLS} type="date" value={form.eventDate} onChange={set('eventDate')} />
                </Field>
                <Field label="Livestream URL" full>
                  <input className={INPUT_CLS} placeholder="https://..." type="url" value={form.livestreamUrl} onChange={set('livestreamUrl')} />
                </Field>
              </div>
            </SectionCard>

            <div className="flex justify-end gap-3">
              <button className={BTN_OUTLINE} onClick={() => setStep(1)}>Back</button>
              <button className={BTN_PRIMARY} disabled={!form.name.trim() || saving} onClick={saveCampaign}>
                Continue <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-5">
            <p className="text-sm text-muted-foreground">
              Connect a CHT post-event feedback survey for survey reporting. External platform CSVs
              can still be uploaded below.
            </p>

            <div className="rounded-xl border border-border bg-card">
              <div className="flex items-center justify-between px-5 py-4">
                <div className="flex items-center gap-2">
                  <div className={cn('h-2 w-2 rounded-full', hubspotStatus?.connected ? 'bg-emerald-500' : 'bg-muted-foreground/30')} />
                  <span className="text-sm font-semibold text-foreground">HubSpot CRM</span>
                </div>
                <span className={cn('rounded-full px-2 py-1 text-xs', hubspotStatus?.connected ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-muted text-muted-foreground')}>
                  {hubspotStatus?.connected ? 'Connected' : 'Not Connected'}
                </span>
              </div>
              {!hubspotStatus?.connected && (
                <p className="px-5 pb-4 text-xs text-muted-foreground">
                  Add HUBSPOT_ACCESS_TOKEN to environment secrets to enable CRM sync. HubSpot is optional.
                </p>
              )}
            </div>

            <div className="overflow-hidden rounded-xl border border-border bg-card">
              <div className="border-b border-border bg-muted px-5 py-4">
                <h2 className="text-xs font-semibold uppercase tracking-wide text-foreground">Reporting Data Sources</h2>
              </div>
              <div className="divide-y divide-border">
                {PLATFORMS.map((p) => {
                  const selected = platforms.includes(p);
                  const uploadedFile = uploads[p];
                  return (
                    <div
                      key={p}
                      className={cn(
                        'flex items-center gap-4 px-5 py-4',
                        p === 'survey' && 'flex-wrap lg:flex-nowrap',
                      )}
                    >
                      <div className="flex min-w-0 flex-1 items-center gap-3">
                        <div
                          className={cn(
                            'h-4 w-4 flex-shrink-0 rounded-full border-2',
                            uploadedFile ? 'border-primary bg-primary' : selected ? 'border-primary' : 'border-border',
                          )}
                        />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-foreground">{PLATFORM_LABELS[p]}</span>
                            {uploadedFile ? (
                              <span className="truncate text-[10px] text-primary">{uploadedFile}</span>
                            ) : (
                              !selected && <span className="text-[10px] text-muted-foreground">(not selected)</span>
                            )}
                          </div>
                          <p className="truncate text-xs text-muted-foreground">{PLATFORM_UPLOAD_DESCRIPTIONS[p]}</p>
                        </div>
                      </div>
                      <div className={p === 'survey' ? 'w-full max-w-md' : 'flex-shrink-0'}>
                        {p === 'survey' ? (
                          <div className="flex flex-col gap-2 sm:flex-row">
                            <select
                              value={selectedSurveyId}
                              onChange={(event) => setSelectedSurveyId(event.target.value)}
                              disabled={!selected || feedbackSurveysLoading}
                              className={`${INPUT_CLS} min-w-0 flex-1 disabled:cursor-not-allowed disabled:opacity-50`}
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
                                  {survey.program?.title ?? 'Program'}: {survey.title} (
                                  {survey.responseCount ?? 0} responses)
                                </option>
                              ))}
                            </select>
                            <button
                              type="button"
                              onClick={connectSelectedSurvey}
                              disabled={
                                !selectedSurveyId ||
                                !selected ||
                                connectFeedbackSurvey.isPending
                              }
                              className={BTN_OUTLINE}
                            >
                              {connectFeedbackSurvey.isPending ? 'Connecting…' : 'Use responses'}
                            </button>
                          </div>
                        ) : (
                          <label className="cursor-pointer">
                            <input accept=".csv" className="sr-only" type="file" onChange={handleFileChange(p)} />
                            <span className="inline-flex items-center gap-1 rounded-lg border border-primary/40 px-3 py-1.5 text-xs text-primary transition-colors hover:border-primary hover:bg-primary/10">
                              <Upload className="h-3 w-3" />
                              Upload CSV
                            </span>
                          </label>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <button className={BTN_OUTLINE} onClick={() => setStep(2)}>Back</button>
              <button className={`${BTN_OUTLINE} text-muted-foreground`} onClick={() => setStep(4)}>Skip</button>
              <button className={BTN_PRIMARY} onClick={() => setStep(4)}>
                Continue <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-5">
            <p className="text-sm text-muted-foreground">
              Review data availability before generating your report. Missing data sections will show clear warnings
              in the report.
            </p>

            <div className="space-y-3">
              {(validation?.dataSourcesSummary ?? []).map((source) => {
                const available = source.status === 'available';
                return (
                  <div key={source.source} className="rounded-xl border border-border bg-card">
                    <div className={cn('flex items-center gap-3 px-5 py-4', !available && source.metricsMissing.length > 0 && 'border-b border-border')}>
                      {available ? (
                        <CircleCheckIcon className="h-4 w-4 text-emerald-500" />
                      ) : (
                        <CircleXIcon className="h-4 w-4 text-accent" />
                      )}
                      <span className="text-sm font-semibold text-foreground">{source.source}</span>
                      <span className={cn('ml-auto rounded-full px-2 py-0.5 text-[10px] font-semibold', available ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' : 'bg-accent/15 text-accent')}>
                        {available ? 'Ready' : 'Missing'}
                      </span>
                    </div>
                    {!available && source.metricsMissing.length > 0 && (
                      <div className="bg-accent/5 px-5 py-3">
                        <p className="mb-1 text-xs font-medium text-accent">Missing metrics:</p>
                        <p className="text-xs text-muted-foreground">
                          {source.metricsMissing.join(', ')}, {' '}
                          {source.source === 'Survey'
                            ? 'select a CHT program feedback survey to include these metrics.'
                            : `upload ${source.source} CSV export to include these metrics.`}
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="flex justify-end gap-3">
              <button className={BTN_OUTLINE} onClick={() => setStep(3)}>Back</button>
              <button className={`${BTN_PRIMARY} px-6`} onClick={generateReport}>
                Generate Report <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </ChromeContainer>
  );
}
