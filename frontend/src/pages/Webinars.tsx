import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { programsApi, type Program } from '../api/programs';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import { Award, DollarSign } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const TEMP_USER_ID = '1234567890';

function formatMoney(value?: number | null) {
  if (!value) return '$0';
  return `$${value.toLocaleString()}`;
}

// Temporary: until backend gives webinar date/time + reward ranges
function tempWhenLabel() {
  return 'Friday, Feb 14 • 7:00 PM ET';
}

export default function Webinars() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [visibleCount, setVisibleCount] = useState(8);

  const { data: programs, isLoading } = useQuery({
    queryKey: ['programs'],
    queryFn: programsApi.getAll,
  });

  const { data: enrollments } = useQuery({
    queryKey: ['enrollments', TEMP_USER_ID],
    queryFn: () => programsApi.getEnrollments(TEMP_USER_ID),
  });

  const enrollMutation = useMutation({
    mutationFn: ({ programId }: { programId: string }) =>
      programsApi.enroll(TEMP_USER_ID, programId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['enrollments'] });
    },
  });

  const enrolledProgramIds = useMemo(
    () => new Set(enrollments?.map((e) => e.programId) || []),
    [enrollments]
  );

  const availablePrograms = useMemo(() => {
    return (programs || []).filter((p) => !enrolledProgramIds.has(p.id));
  }, [programs, enrolledProgramIds]);

  const opportunityCount = availablePrograms.length;

  if (isLoading) return <LoadingSpinner />;

  const featured = programs?.[0]; // TODO: backend field: isFeatured

  const listItems = (programs || []).slice(0, visibleCount);
  const canShowMore = (programs || []).length > visibleCount;

  return (
    <div className="space-y-8">
      {/* Header */}
      <header className="space-y-2">
        <h1 className="text-2xl md:text-3xl font-semibold text-gray-900">Webinars</h1>
        <p className="text-sm text-gray-600">
          You have{' '}
          <span className="font-semibold text-gray-900">{opportunityCount}</span>{' '}
          new opportunities to earn rewards today
        </p>
      </header>

      {/* Featured Webinars */}
      <section className="space-y-3">
        <h2 className="text-base font-semibold text-gray-900">Featured Webinars</h2>

        {featured ? (
          <FeaturedWebinarCard
            program={featured}
            enrolled={enrolledProgramIds.has(featured.id)}
            isLoading={enrollMutation.isPending}
            onRegister={() => enrollMutation.mutate({ programId: featured.id })}
            onMoreInfo={() => navigate(`/webinars/${featured.id}`)}
          />
        ) : (
          <EmptyState
            title="No featured webinars"
            subtitle="Check back soon for new opportunities."
          />
        )}
      </section>

      {/* Upcoming Activities */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900">Upcoming Activities</h2>
          <button className="text-sm font-medium text-gray-700 hover:text-gray-900">
            View All Activities
          </button>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="divide-y divide-gray-200">
            {listItems.map((p) => {
              const isEnrolled = enrolledProgramIds.has(p.id);

              const meta = [
                p.sponsorName ? p.sponsorName : null,
                typeof p.creditAmount === 'number' ? `${p.creditAmount} CME Credits` : null,
                p.honorariumAmount ? `${formatMoney(p.honorariumAmount)} honorarium` : null,
              ]
                .filter(Boolean)
                .join(' • ');

              return (
                <ActivityRow
                  key={p.id}
                  title={p.title}
                  secondary={meta || 'Webinar opportunity'}
                  enrolled={isEnrolled}
                  loading={enrollMutation.isPending}
                  onRegister={() => enrollMutation.mutate({ programId: p.id })}
                  onMoreInfo={() => navigate(`/webinars/${p.id}`)}
                />
              );
            })}
          </div>

          <div className="p-3">
            {canShowMore ? (
              <button
                onClick={() => setVisibleCount((v) => v + 8)}
                className="w-full rounded-lg border border-gray-200 bg-white py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Show More
              </button>
            ) : null}
          </div>
        </div>

        {(programs || []).length === 0 && (
          <EmptyState
            title="No webinars available"
            subtitle="No opportunities are available at the moment."
          />
        )}
      </section>
    </div>
  );
}

/** --- UI Blocks --- */

function FeaturedWebinarCard({
  program,
  enrolled,
  isLoading,
  onRegister,
  onMoreInfo,
}: {
  program: Program;
  enrolled: boolean;
  isLoading: boolean;
  onRegister: () => void;
  onMoreInfo: () => void;
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="space-y-2 min-w-0">
          <p className="text-sm font-semibold text-gray-900">{program.title}</p>

          <h3 className="text-xl font-semibold text-gray-900 line-clamp-2">
            {program.description}
          </h3>

          <div className="flex flex-wrap items-center gap-3 pt-1 text-sm text-gray-700">
            {program.sponsorName ? (
              <span className="font-medium">{program.sponsorName}</span>
            ) : null}

            <span className="inline-flex items-center gap-1 text-gray-700">
              <Award className="h-4 w-4" /> {program.creditAmount} CME Credits
            </span>

            {program.honorariumAmount ? (
              <span className="inline-flex items-center gap-1 font-semibold text-gray-900">
                <DollarSign className="h-4 w-4" /> {formatMoney(program.honorariumAmount)}
              </span>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-gray-700 bg-gray-100 border border-gray-200 rounded-full px-2 py-1">
              Double points until Friday
            </span>
            <span className="text-sm text-gray-700">{tempWhenLabel()}</span>
          </div>

          <button
            onClick={onMoreInfo}
            className="text-sm font-medium text-gray-700 hover:text-gray-900"
          >
            More Info →
          </button>
        </div>

        <div className="md:pt-1">
          <button
            onClick={onRegister}
            disabled={enrolled || isLoading}
            className={[
              'w-full md:w-auto rounded-lg px-4 py-2 text-sm font-semibold',
              enrolled || isLoading
                ? 'bg-gray-200 text-gray-600 cursor-not-allowed'
                : 'bg-gray-900 text-white hover:bg-black',
            ].join(' ')}
          >
            {enrolled ? 'Registered' : isLoading ? 'Registering…' : 'Register Now'}
          </button>
        </div>
      </div>
    </div>
  );
}

function ActivityRow({
  title,
  secondary,
  enrolled,
  loading,
  onRegister,
  onMoreInfo,
}: {
  title: string;
  secondary: string;
  enrolled: boolean;
  loading: boolean;
  onRegister: () => void;
  onMoreInfo: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3">
      <div className="min-w-0">
        <p className="font-medium text-gray-900 truncate">{title}</p>
        <p className="text-sm text-gray-600 truncate">{secondary}</p>
      </div>

      <div className="shrink-0 flex items-center gap-3">
        <button
          onClick={onMoreInfo}
          className="text-sm font-medium text-gray-700 hover:text-gray-900"
        >
          More Info →
        </button>

        <button
          onClick={onRegister}
          disabled={enrolled || loading}
          className={[
            'rounded-lg px-3 py-2 text-sm font-semibold',
            enrolled || loading
              ? 'bg-gray-200 text-gray-600 cursor-not-allowed'
              : 'bg-gray-900 text-white hover:bg-black',
          ].join(' ')}
        >
          {enrolled ? 'Registered' : loading ? 'Registering…' : 'Register Now'}
        </button>
      </div>
    </div>
  );
}

function EmptyState({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="text-center py-10">
      <p className="text-base font-semibold text-gray-900">{title}</p>
      <p className="mt-1 text-sm text-gray-600">{subtitle}</p>
    </div>
  );
}
