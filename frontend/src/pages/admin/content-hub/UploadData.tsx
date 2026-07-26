import { useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Upload } from 'lucide-react';
import ChromeContainer from './components/ChromeContainer';
import { useToast } from './components/Toaster';
import {
  useConnectFeedbackSurvey,
  useCsvData,
  useFeedbackSurveys,
  useUploadCsv,
} from './lib/hooks';
import { cn, formatDate } from './lib/utils';
import type { Platform } from './lib/types';

interface PlatformConfig {
  id: Platform;
  label: string;
  color: string;
  description: string;
}

const PLATFORMS: PlatformConfig[] = [
  { id: 'linkedin', label: 'LinkedIn', color: '#0077B5', description: 'Campaign Manager export: impressions, video views, dwell time, completions' },
  { id: 'meta', label: 'Meta', color: '#7B5EA7', description: 'Ads Manager export: impressions, reach, link clicks, CTR, demographics' },
  { id: 'youtube', label: 'YouTube', color: '#FF0000', description: 'Studio Analytics export: views, watch time, CTR, engaged views' },
  { id: 'livestream', label: 'Livestream', color: '#3da4c0', description: 'Event platform export: registrations, attendees, HCP verification rate' },
  { id: 'survey', label: 'Survey', color: '#2E7D32', description: 'CHT post-event feedback: responses, practice-change intent, confidence lift' },
];

export default function UploadData() {
  const { id = '' } = useParams<{ id: string }>();
  const { toast } = useToast();
  const [activePlatform, setActivePlatform] = useState<Platform>('linkedin');
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedSurveyId, setSelectedSurveyId] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const active = PLATFORMS.find((p) => p.id === activePlatform)!;

  const { data: uploads } = useCsvData(id);
  const uploadMutation = useUploadCsv(id);
  const connectFeedbackSurvey = useConnectFeedbackSurvey(id);
  const { data: feedbackSurveys = [], isLoading: feedbackSurveysLoading } =
    useFeedbackSurveys(activePlatform === 'survey');

  async function connectSurvey() {
    const survey = feedbackSurveys.find((item) => item.id === selectedSurveyId);
    if (!survey) return;
    try {
      const result = await connectFeedbackSurvey.mutateAsync(survey);
      toast({
        title: `Connected ${result.rowCount} feedback response${result.rowCount === 1 ? '' : 's'}`,
        description: result.filename,
      });
    } catch (err) {
      toast({
        title: 'Connection failed',
        description: err instanceof Error ? err.message : String(err),
        variant: 'destructive',
      });
    }
  }

  async function uploadFile(file: File) {
    if (uploading) return;
    setUploading(true);
    try {
      const content = await file.text();
      const result = await uploadMutation.mutateAsync({
        platform: activePlatform,
        filename: file.name,
        content,
      });
      const rowCount =
        typeof result?.rowCount === 'number'
          ? result.rowCount
          : Math.max(content.trim().split(/\r?\n/).length - 1, 0);
      toast({ title: `Uploaded ${rowCount} rows` });
    } catch (err) {
      toast({
        title: 'Upload failed',
        description: err instanceof Error ? err.message : String(err),
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  return (
    <ChromeContainer>
      <div className="mx-auto w-full max-w-3xl">
        <div className="mb-6 flex items-center gap-3">
          <Link
            to={`/admin/content-hub/campaigns/${id}`}
            className="text-muted-foreground hover:text-foreground"
            aria-label="Back to campaign"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Connect Platform Data</h1>
            <p className="text-sm text-muted-foreground">
              Select CHT feedback responses or upload an external platform CSV.
            </p>
          </div>
        </div>

        <div className="mb-6 grid grid-cols-5 gap-2">
          {PLATFORMS.map((p) => (
            <button
              key={p.id}
              onClick={() => setActivePlatform(p.id)}
              className={cn(
                'relative flex flex-col items-center gap-1 rounded-xl border-2 p-3 text-center transition-all',
                activePlatform === p.id
                  ? 'border-primary bg-primary/10'
                  : 'border-border bg-card hover:border-primary/40',
              )}
            >
              <span className="text-sm font-semibold" style={{ color: p.color }}>
                {p.label}
              </span>
            </button>
          ))}
        </div>

        {activePlatform === 'survey' ? (
          <div className="space-y-4 rounded-xl border border-border bg-card p-6">
            <div>
              <h2 className="font-semibold text-foreground">CHT feedback survey responses</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Select the post-event feedback survey for the program represented by this report.
                Only aggregate, PII-safe analytics are connected.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <select
                value={selectedSurveyId}
                onChange={(event) => setSelectedSurveyId(event.target.value)}
                disabled={feedbackSurveysLoading}
                className="h-10 min-w-0 flex-1 rounded-lg border border-border bg-background px-3 text-sm text-foreground"
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
                onClick={() => void connectSurvey()}
                disabled={!selectedSurveyId || connectFeedbackSurvey.isPending}
                className="inline-flex h-10 items-center justify-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50"
              >
                {connectFeedbackSurvey.isPending ? 'Connecting…' : 'Use responses'}
              </button>
            </div>
          </div>
        ) : (
          <div
            className={cn(
              'relative flex cursor-pointer flex-col items-center gap-3 rounded-xl border-2 border-dashed py-14 transition-all',
              dragging
                ? 'border-primary bg-primary/5'
                : 'border-border bg-card hover:border-primary/50 hover:bg-muted/50',
            )}
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              const file = e.dataTransfer.files?.[0];
              if (file) void uploadFile(file);
            }}
          >
          <input
            ref={fileInputRef}
            accept=".csv"
            className="sr-only"
            type="file"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void uploadFile(file);
            }}
          />
          <div
            className="flex h-12 w-12 items-center justify-center rounded-full"
            style={{ backgroundColor: `${active.color}20` }}
          >
            <Upload className="h-6 w-6" style={{ color: active.color }} />
          </div>
          <div className="text-center">
            <p className="font-semibold text-foreground">Drop {active.label} CSV here</p>
            <p className="mt-0.5 text-sm text-muted-foreground">{active.description}</p>
            <p className="mt-3 text-xs text-muted-foreground">or click to browse files</p>
          </div>
          </div>
        )}

        <div className="mt-6 rounded-xl border border-border bg-card">
          <div className="border-b border-border px-5 py-3">
            <span className="text-sm font-semibold text-foreground">All Uploads</span>
          </div>
          <div className="divide-y divide-border">
            {PLATFORMS.map((p) => {
              const upload = uploads?.find((u) => u.platform === p.id);
              return (
                <div key={p.id} className="flex items-center gap-3 px-5 py-2.5">
                  <div
                    className={cn('h-2 w-2 rounded-full', upload ? 'bg-primary' : 'bg-muted-foreground/30')}
                  />
                  <span className="flex-1 text-sm text-foreground">{p.label}</span>
                  <span className="text-xs text-muted-foreground">
                    {upload
                      ? `${upload.filename} · ${upload.rowCount} rows · ${formatDate(upload.uploadedAt)}`
                      : p.id === 'survey'
                        ? 'Not connected'
                        : 'Not uploaded'}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </ChromeContainer>
  );
}
