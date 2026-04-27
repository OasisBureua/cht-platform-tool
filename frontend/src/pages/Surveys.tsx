import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { ArrowRight, ClipboardList, AlertCircle, Loader2, ClipboardCheck } from 'lucide-react';
import { surveysApi, type Survey, type SurveyType } from '../api/surveys';

const CARD_IMAGES = [
  '/images/iStock-1473559425-01131144-01b5-4e7d-9b15-f3db8846cad3.png',
  '/images/iStock-1667819272-cc7e9fde-feb0-4590-bb35-f5a86deba0dd.png',
  '/images/iStock-1917170353-5564763c-6ced-49b2-93ff-6a2261700399.png',
  '/images/iStock-1938555104-3986b580-5ef8-4aae-989f-05a2edd0bc12.png',
  '/images/iStock-2036497889-fae3ed6e-9859-4983-b3ec-7a489bb6fb95.png',
  '/images/iStock-1344792109-f418c5f0-d729-4965-8b2a-bfff4368cea3.png',
] as const;

function honorariumCentsToDollars(cents?: number | null): number {
  if (cents == null || cents <= 0) return 0;
  return cents / 100;
}

function formatHonorarium(cents?: number | null) {
  const dollars = honorariumCentsToDollars(cents);
  if (dollars <= 0) return null;
  return `$${dollars.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function typeBadge(type: SurveyType) {
  if (type === 'FEEDBACK') return { label: 'Post-event', className: 'bg-violet-100 text-violet-900' };
  if (type === 'PRE_TEST') return { label: 'Pre-test', className: 'bg-sky-100 text-sky-900' };
  if (type === 'POST_TEST') return { label: 'Post-test', className: 'bg-teal-100 text-teal-900' };
  return { label: type, className: 'bg-gray-100 text-gray-800' };
}

export default function Surveys() {
  const { user } = useAuth();
  const userId = user?.userId;
  const { data: surveys = [], isLoading } = useQuery({
    queryKey: ['surveys', userId],
    queryFn: surveysApi.getAll,
    enabled: Boolean(userId),
    staleTime: 5 * 60 * 1000,
  });
  const activeCount = surveys.length;
  const completedCount = 0;
  const expiringCount = activeCount > 0 ? 1 : 0;
  const availableToEarn = useMemo(
    () =>
      surveys.reduce((sum, s) => sum + honorariumCentsToDollars(s.program?.honorariumAmount ?? null), 0),
    [surveys],
  );

  return (
    <div className="-mt-[15px] space-y-2.5 sm:space-y-4">
      <div className="flex items-center gap-2.5 text-zinc-900 dark:text-zinc-100">
        <ClipboardCheck className="h-5 w-5 text-brand-700" strokeWidth={2} aria-hidden />
        <h1 className="text-balance text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 md:text-3xl">Your Surveys</h1>
      </div>
      <p className="text-pretty text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
        <strong>Post-event</strong> surveys unlock after your Live session ends. Complete them within 7 days to receive
        your honorarium. Keep{' '}
        <Link to="/app/payments" className="font-semibold text-zinc-900 underline dark:text-zinc-100">
          Payments
        </Link>{' '}
        (W-9 and bank details) current so payouts can be processed.
      </p>

      <section className="space-y-3.5 pt-1">
        <div className="-mt-[10px] rounded-2xl border border-gray-200/90 bg-white p-4 shadow-[0_1px_0_rgba(0,0,0,0.04),0_10px_30px_-16px_rgba(0,0,0,0.1)] dark:border-zinc-800/90 dark:bg-zinc-900 dark:shadow-[0_1px_0_rgba(255,255,255,0.04)_inset,0_10px_30px_-16px_rgba(0,0,0,0.45)] md:p-5">
          <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">Survey eligible for payment</p>
              <h2 className="mt-1 text-balance text-lg font-bold text-zinc-900 dark:text-zinc-100 md:text-xl">
                Surveys open after each webinar session
              </h2>
              <p className="mt-1 text-pretty text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                Join a webinar first. Once the session ends, the survey appears here for completion.
              </p>
            </div>
            <Link
              to="/app/live"
              className="inline-flex h-11 min-w-[176px] shrink-0 items-center justify-center gap-2 rounded-md bg-zinc-900 px-5 text-sm font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.1)] transition-[background-color,transform] duration-200 ease-[cubic-bezier(0.2,0,0,1)] hover:bg-black active:scale-[0.96]"
            >
              Go to live sessions
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <StatChip label="Active surveys" value={activeCount} />
          <StatChip label="Completed" value={completedCount} />
          <StatChip label="Expiring" value={expiringCount} />
          <div className="ml-0 inline-flex min-h-[44px] items-center rounded-full bg-brand-50 px-5 py-2 text-sm font-semibold text-brand-800 tabular-nums dark:bg-brand-950/40 dark:text-brand-200 sm:ml-2">
            {availableToEarn > 0
              ? `$${availableToEarn.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })} available to earn`
              : 'Honorarium set per webinar'}
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-10 w-10 animate-spin text-gray-400" />
          </div>
        ) : surveys.length === 0 ? (
          <div className="rounded-2xl border border-gray-200 bg-white p-12 text-center shadow-[0_1px_0_rgba(0,0,0,0.04),0_8px_24px_-12px_rgba(0,0,0,0.08)] dark:border-zinc-800 dark:bg-zinc-900 dark:shadow-[0_1px_0_rgba(255,255,255,0.04)_inset,0_8px_24px_-12px_rgba(0,0,0,0.45)]">
            <p className="font-semibold text-gray-900 dark:text-zinc-100">No post-session surveys yet</p>
            <p className="mt-1 text-sm text-gray-600 dark:text-zinc-400">Enroll in a Live activity, then check back after the session ends.</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-500">Active surveys</h3>
            <div className="grid min-w-0 grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {surveys.map((survey, idx) => (
                <SurveyGridCard key={survey.id} survey={survey} imageUrl={CARD_IMAGES[idx % CARD_IMAGES.length]} />
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

function StatChip({ label, value }: { label: string; value: number }) {
  return (
    <div className="inline-flex min-h-[44px] items-center gap-2 rounded-full border border-zinc-200 bg-white px-4 py-2 text-xs font-medium text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
      <span className="tabular-nums text-sm font-semibold text-zinc-900 dark:text-zinc-100">{value}</span>
      <span>{label}</span>
    </div>
  );
}

function SurveyGridCard({ survey, imageUrl }: { survey: Survey; imageUrl: string }) {
  const honorarium = formatHonorarium(survey.program?.honorariumAmount ?? null);
  const payoutLabel = honorarium ?? '—';
  const remainingDays = getRemainingDays(survey.updatedAt);
  const badge = typeBadge(survey.type);

  return (
    <Link
      to={`/app/surveys/${survey.id}`}
      className="group block min-w-0 overflow-hidden rounded-lg border border-zinc-200/80 bg-white shadow-[0_1px_0_rgba(0,0,0,0.04),0_6px_20px_-10px_rgba(0,0,0,0.1)] transition-[transform,box-shadow] duration-200 ease-[cubic-bezier(0.2,0,0,1)] hover:shadow-[0_1px_0_rgba(0,0,0,0.05),0_10px_28px_-10px_rgba(0,0,0,0.15)] active:scale-[0.96] dark:border-zinc-800 dark:bg-zinc-900 dark:shadow-[0_1px_0_rgba(255,255,255,0.04)_inset,0_6px_20px_-10px_rgba(0,0,0,0.45)]"
    >
      <div className="relative aspect-[249/140] w-full overflow-hidden">
        <img
          src={imageUrl}
          alt=""
          className="h-full w-full object-cover outline outline-1 -outline-offset-1 outline-black/10"
          loading="lazy"
          referrerPolicy="no-referrer"
          draggable={false}
        />
      </div>
      <div className="space-y-2.5 p-3">
        <div className="flex items-start justify-between gap-2">
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${badge.className}`}>{badge.label}</span>
          <span className="tabular-nums inline-flex items-center text-base font-extrabold text-zinc-900 dark:text-zinc-100">{payoutLabel}</span>
        </div>

        <p className="line-clamp-2 text-left text-[13px] font-semibold leading-snug text-zinc-900 dark:text-zinc-100 [overflow-wrap:anywhere]">
          {survey.title}
        </p>
        {survey.program?.title ? (
          <p className="line-clamp-1 text-left text-[11px] text-zinc-500">{survey.program.title}</p>
        ) : null}
        {honorarium ? (
          <p className="text-[10px] font-medium leading-snug text-zinc-600">
            Listed honorarium (after completion). Payouts require a completed W-9 under Payments.
          </p>
        ) : null}

        <div className="flex flex-wrap items-center gap-1.5">
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-800">
            <AlertCircle className="h-3 w-3" aria-hidden />
            {survey.required ? 'Survey Required' : 'Optional'}
          </span>
          <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-medium text-rose-700 tabular-nums">
            {remainingDays}d remaining
          </span>
        </div>

        <div className="flex w-full justify-center">
          <span className="inline-flex min-h-[40px] min-w-[132px] items-center justify-center gap-1.5 rounded-md bg-brand-600 px-4 text-xs font-semibold text-white transition-[background-color,transform] duration-200 ease-[cubic-bezier(0.2,0,0,1)] group-hover:bg-brand-700 group-active:scale-[0.96]">
            <ClipboardList className="h-3.5 w-3.5" aria-hidden />
            {survey.type === 'FEEDBACK' ? 'Complete post-event' : 'Take Survey'}
          </span>
        </div>
      </div>
    </Link>
  );
}

function getRemainingDays(updatedAt: string): number {
  const updated = new Date(updatedAt).getTime();
  if (Number.isNaN(updated)) return 7;
  const expiresAt = updated + 7 * 24 * 60 * 60 * 1000;
  const now = Date.now();
  const remainingMs = Math.max(0, expiresAt - now);
  return Math.max(1, Math.ceil(remainingMs / (24 * 60 * 60 * 1000)));
}
