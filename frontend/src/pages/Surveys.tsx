import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { surveysApi } from '../api/surveys';
import type { SurveyType } from '../api/surveys';

function formatHonorarium(cents?: number | null) {
  if (cents == null || cents <= 0) return null;
  return `$${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function typeBadge(type: SurveyType) {
  if (type === 'FEEDBACK') return { label: 'Post-event', className: 'bg-violet-100 text-violet-900' };
  if (type === 'PRE_TEST') return { label: 'Pre-test', className: 'bg-sky-100 text-sky-900' };
  if (type === 'POST_TEST') return { label: 'Post-test', className: 'bg-teal-100 text-teal-900' };
  return { label: type, className: 'bg-gray-100 text-gray-800' };
}

export default function Surveys() {
  const { data: surveys = [], isLoading } = useQuery({
    queryKey: ['surveys'],
    queryFn: surveysApi.getAll,
    staleTime: 5 * 60 * 1000,
  });

  const featured = surveys[0];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Surveys</h1>
        <p className="mt-1 text-sm text-gray-600 max-w-3xl">
          <strong>Post-event</strong> surveys unlock after your LIVE session ends. Complete them here and keep{' '}
          <Link to="/app/payments" className="font-semibold text-gray-900 underline">
            Payments
          </Link>{' '}
          (W-9 and bank details) current so honoraria can be processed.
        </p>
      </div>

      {featured ? (
        <section className="rounded-2xl border border-gray-200 bg-gradient-to-br from-gray-900 to-gray-800 p-6 text-white">
          <p className="text-xs font-semibold uppercase tracking-wide text-white/70">Featured</p>
          <h2 className="mt-2 text-xl font-bold">{featured.title}</h2>
          {featured.program?.title ? (
            <p className="mt-1 text-sm text-white/85">Activity: {featured.program.title}</p>
          ) : null}
          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              to={`/app/surveys/${featured.id}`}
              className="inline-flex rounded-lg bg-white px-4 py-2 text-sm font-semibold text-gray-900 hover:bg-gray-100"
            >
              Open survey
            </Link>
            <Link
              to="/app/payments"
              className="inline-flex rounded-lg border border-white/40 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10"
            >
              Payments &amp; W-9
            </Link>
          </div>
        </section>
      ) : null}

      <section className="space-y-3">
        <h2 className="text-lg font-bold text-gray-900">All surveys</h2>
        {isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-10 w-10 animate-spin text-gray-400" />
          </div>
        ) : surveys.length === 0 ? (
          <div className="rounded-2xl border border-gray-200 bg-white p-12 text-center">
            <p className="font-semibold text-gray-900">No surveys yet</p>
            <p className="mt-1 text-sm text-gray-600">Check back after you enroll in a LIVE activity.</p>
          </div>
        ) : (
          <ul className="space-y-3">
            {surveys.map((s) => {
              const badge = typeBadge(s.type);
              const honorarium = formatHonorarium(s.program?.honorariumAmount ?? null);
              return (
                <li key={s.id}>
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-2xl border border-gray-200 bg-white p-4">
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${badge.className}`}
                        >
                          {badge.label}
                        </span>
                        {s.program?.creditAmount != null ? (
                          <span className="text-xs font-medium text-gray-600">{s.program.creditAmount} CME</span>
                        ) : null}
                      </div>
                      <p className="font-semibold text-gray-900">{s.title}</p>
                      <p className="text-sm text-gray-600 line-clamp-2">
                        {s.description || 'Share your feedback for this activity.'}
                      </p>
                      {s.program?.title ? (
                        <p className="text-xs text-gray-500">Program: {s.program.title}</p>
                      ) : null}
                      {honorarium ? (
                        <p className="text-xs font-medium text-gray-800">
                          Honorarium (after completion): {honorarium} — payouts require a completed W-9 under Payments.
                        </p>
                      ) : null}
                    </div>
                    <Link
                      to={`/app/surveys/${s.id}`}
                      className="shrink-0 self-start sm:self-center rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-black"
                    >
                      {s.type === 'FEEDBACK' ? 'Complete post-event' : 'Open'}
                    </Link>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
