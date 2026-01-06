import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import { surveysApi } from '../api/surveys';
import type { Survey, SurveyType } from '../api/surveys';
import { Search, ArrowRight, ClipboardList } from 'lucide-react';

const TYPE_LABEL: Record<SurveyType, string> = {
  PRE_TEST: 'Pre-test',
  POST_TEST: 'Post-test',
  FEEDBACK: 'Feedback',
};

export default function Surveys() {
  const [q, setQ] = useState('');
  const [type, setType] = useState<SurveyType | 'ALL'>('ALL');

  const { data, isLoading, isError } = useQuery({
    queryKey: ['surveys'],
    queryFn: surveysApi.getAll,
  });

  const surveys = data || [];

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    return surveys
      .filter((s) => (type === 'ALL' ? true : s.type === type))
      .filter((s) => {
        if (!query) return true;
        const haystack = [
          s.title,
          s.description || '',
          s.type,
          s.program?.title || '',
          s.program?.sponsorName || '',
        ]
          .join(' ')
          .toLowerCase();
        return haystack.includes(query);
      });
  }, [surveys, q, type]);

  if (isLoading) return <LoadingSpinner />;

  if (isError) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-gray-50 p-10 text-center">
        <p className="font-semibold text-gray-900">We couldn’t load surveys.</p>
        <p className="mt-1 text-sm text-gray-600">Please refresh and try again.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <header className="space-y-2">
        <h1 className="text-2xl md:text-3xl font-semibold text-gray-900">Surveys</h1>
        <p className="text-sm text-gray-600">
          Complete surveys to support research and unlock rewards (when enabled).
        </p>
      </header>

      {/* Controls */}
      <section className="space-y-3">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          {/* Search */}
          <div className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-white px-4 py-3 shadow-sm md:w-[520px]">
            <Search className="h-4 w-4 text-gray-400" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search surveys by title, program, sponsor…"
              className="w-full bg-transparent text-sm text-gray-900 placeholder:text-gray-400 outline-none"
            />
          </div>

          <div className="text-sm text-gray-600">
            <span className="font-semibold text-gray-900">{filtered.length}</span> surveys
          </div>
        </div>

        {/* Type filter */}
        <div className="flex flex-wrap items-center gap-2">
          <Pill active={type === 'ALL'} onClick={() => setType('ALL')}>
            All
          </Pill>
          <Pill active={type === 'PRE_TEST'} onClick={() => setType('PRE_TEST')}>
            Pre-test
          </Pill>
          <Pill active={type === 'POST_TEST'} onClick={() => setType('POST_TEST')}>
            Post-test
          </Pill>
          <Pill active={type === 'FEEDBACK'} onClick={() => setType('FEEDBACK')}>
            Feedback
          </Pill>
        </div>
      </section>

      {/* List */}
      {filtered.length === 0 ? (
        <EmptyState title="No surveys found" subtitle="Try a different search or filter." />
      ) : (
        <section className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="divide-y divide-gray-200">
            {filtered.map((s) => (
              <SurveyRow key={s.id} survey={s} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function SurveyRow({ survey }: { survey: Survey }) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3">
      <div className="min-w-0">
        <p className="font-medium text-gray-900 truncate">{survey.title}</p>
        <p className="text-sm text-gray-600 truncate">
          {survey.program?.title ? `${survey.program.title} • ` : ''}
          {survey.type ? `${TYPE_LABEL[survey.type]} • ` : ''}
          {survey.required ? 'Required' : 'Optional'}
        </p>
      </div>

      <Link
        to={`/app/surveys/${survey.id}`}
        className="shrink-0 inline-flex items-center gap-2 rounded-lg bg-gray-900 px-3 py-2 text-sm font-semibold text-white hover:bg-black"
      >
        View <ArrowRight className="h-4 w-4" />
      </Link>
    </div>
  );
}

function Pill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'rounded-full px-3 py-1.5 text-xs font-semibold border transition-colors',
        active
          ? 'bg-gray-900 text-white border-gray-900'
          : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50',
      ].join(' ')}
    >
      {children}
    </button>
  );
}

function EmptyState({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-gray-50 p-10 text-center">
      <ClipboardList className="mx-auto h-10 w-10 text-gray-400" />
      <p className="mt-3 font-semibold text-gray-900">{title}</p>
      <p className="mt-1 text-sm text-gray-600">{subtitle}</p>
    </div>
  );
}
