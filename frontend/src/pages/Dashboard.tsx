import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { dashboardApi } from '../api/dashboard';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import { DollarSign, Video, ClipboardList, Presentation } from 'lucide-react';
import { format } from 'date-fns';

// TODO: Replace with actual user ID from Auth0
const TEMP_USER_ID = '1234567890';

// TODO: Replace with real user profile data
const TEMP_USER_NAME = 'TESTUSER';

type FeaturedActivity = {
  title: string;
  subtitle: string;
  description: string;
  rewardMin: number;
  rewardMax: number;
  promoText?: string;
  startAt: string; // ISO
  ctaLabel: string;
};

const tempFeatured: FeaturedActivity = {
  title: 'OPDIVO® + YERVOY®',
  subtitle: 'Breakthrough Results in Advanced Melanoma',
  description:
    'Join Dr. Emily Richardson, MD from Memorial Sloan Kettering for exclusive Phase 3 trial insights',
  rewardMin: 900,
  rewardMax: 1800,
  promoText: 'Double points until Friday',
  startAt: '2026-02-14T19:00:00-05:00',
  ctaLabel: 'Register Now',
};

const tempUpcoming = Array.from({ length: 6 }).map((_, idx) => ({
  id: `upcoming-${idx}`,
  title: 'Webinar Name',
  secondary: 'Secondary Text',
  action: idx % 2 === 0 ? 'Register Now' : 'More Info →',
}));

function formatMoneyRange(min: number, max: number) {
  return `$${min.toLocaleString()} – $${max.toLocaleString()}`;
}

export default function Dashboard() {
  const { data: earnings, isLoading: earningsLoading } = useQuery({
    queryKey: ['earnings', TEMP_USER_ID],
    queryFn: () => dashboardApi.getEarnings(TEMP_USER_ID),
  });

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['stats', TEMP_USER_ID],
    queryFn: () => dashboardApi.getStats(TEMP_USER_ID),
  });

  // Derived values (fallback-safe)
  const opportunityCount = useMemo(() => {
    // TODO: replace with real “open opportunities” count from an activities endpoint
    return 0;
  }, []);

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  }, []);

  if (earningsLoading || statsLoading) return <LoadingSpinner />;

  return (
    <div className="space-y-8">
      {/* Top Greeting + Search is handled by your layout TopNav ideally */}
      <header className="space-y-2">
        <h1 className="text-2xl md:text-3xl font-semibold text-gray-900">
          {greeting}, <span className="font-semibold">{TEMP_USER_NAME}</span>
        </h1>
        <p className="text-sm text-gray-600">
          You have <span className="font-semibold text-gray-900">{opportunityCount}</span> new opportunities to earn rewards today
        </p>
      </header>

      {/* 3 Action Cards */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <ActionCard
          icon={<Presentation className="h-5 w-5" />}
          title="Join Webinars"
          description="Attend live medical education sessions and earn $500–$1,000 per webinar"
          onClick={() => {
            // TODO: navigate('/webinars')
          }}
        />
        <ActionCard
          icon={<ClipboardList className="h-5 w-5" />}
          title="Complete Surveys"
          description="Share your insights through voice-based surveys in just 5–10 minutes"
          onClick={() => {
            // TODO: navigate('/surveys')
          }}
        />
        <ActionCard
          icon={<Video className="h-5 w-5" />}
          title="Watch or Listen Content"
          description="View educational videos and earn rewards for staying engaged"
          onClick={() => {
            // TODO: navigate('/watch')
          }}
        />
      </section>

      {/* Featured Activity */}
      <section className="space-y-3">
        <SectionHeader title="Featured Activity" />
        <FeaturedActivityCard activity={tempFeatured} />
      </section>

      {/* Upcoming Activities */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <SectionHeader title="Upcoming Activities" />
          <button className="text-sm font-medium text-gray-700 hover:text-gray-900">
            View All Activities
          </button>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="divide-y divide-gray-200">
            {tempUpcoming.map((row) => (
              <ActivityRow
                key={row.id}
                title={row.title}
                secondary={row.secondary}
                actionLabel={row.action}
                onAction={() => {
                  // TODO: route to activity detail
                }}
              />
            ))}
          </div>

          <div className="p-3">
            <button className="w-full rounded-lg border border-gray-200 bg-white py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
              Show More
            </button>
          </div>
        </div>
      </section>

      {/* Analytics summary tiles (matches PDF “Activities completed / Pending / Next payout”) */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <SectionHeader title="Analytics" />
          <button className="text-sm font-medium text-gray-700 hover:text-gray-900">
            View All Activities
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <MetricTile
            label="Activities completed this week"
            value={stats?.activitiesCompleted ?? 0}
          />
          <MetricTile
            label="Pending Activities"
            value={earnings?.pendingPayments ? 15 : 0 /* TODO: real pending count */}
          />
          <MetricTile
            label="Next Payout Amount"
            value={`$${(earnings?.pendingPayments ?? 0).toFixed(2)}`}
            icon={<DollarSign className="h-5 w-5" />}
          />
        </div>

        <div className="pt-1">
          <button className="text-sm font-medium text-gray-700 hover:text-gray-900">
            View all your performance and tracking on your KOL Dashboard →
          </button>
        </div>
      </section>

      {/* Optional: keep your chart, but move it below as “Performance” or move to /earnings */}
      {/* <EarningsChart ... /> */}
    </div>
  );
}

/** --- Components (move these into /components once approved) --- */

function SectionHeader({ title }: { title: string }) {
  return <h2 className="text-base font-semibold text-gray-900">{title}</h2>;
}

function ActionCard({
  icon,
  title,
  description,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-left bg-white border border-gray-200 rounded-xl p-4 hover:bg-gray-50 transition"
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5 rounded-lg border border-gray-200 p-2 text-gray-700">
          {icon}
        </div>
        <div className="space-y-1">
          <p className="font-semibold text-gray-900">{title}</p>
          <p className="text-sm text-gray-600 leading-relaxed">{description}</p>
        </div>
      </div>
    </button>
  );
}

function FeaturedActivityCard({ activity }: { activity: FeaturedActivity }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="space-y-2">
          <p className="text-sm font-semibold text-gray-900">{activity.title}</p>
          <h3 className="text-xl font-semibold text-gray-900">
            {activity.subtitle}
          </h3>
          <p className="text-sm text-gray-600 max-w-2xl">{activity.description}</p>

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <span className="text-sm font-semibold text-gray-900">
              {formatMoneyRange(activity.rewardMin, activity.rewardMax)}
            </span>
            {activity.promoText && (
              <span className="text-xs font-semibold text-gray-700 bg-gray-100 border border-gray-200 rounded-full px-2 py-1">
                {activity.promoText}
              </span>
            )}
          </div>

          <p className="text-sm text-gray-700">
            {format(new Date(activity.startAt), 'EEEE, MMM d • h:mm a')} ET
          </p>
        </div>

        <div className="md:pt-1">
          <button className="w-full md:w-auto rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-black">
            {activity.ctaLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function ActivityRow({
  title,
  secondary,
  actionLabel,
  onAction,
}: {
  title: string;
  secondary: string;
  actionLabel: string;
  onAction?: () => void;
}) {
  const isPrimary = actionLabel.toLowerCase().includes('register');

  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3">
      <div className="min-w-0">
        <p className="font-medium text-gray-900 truncate">{title}</p>
        <p className="text-sm text-gray-600 truncate">{secondary}</p>
      </div>

      <button
        onClick={onAction}
        className={
          isPrimary
            ? 'shrink-0 rounded-lg bg-gray-900 px-3 py-2 text-sm font-semibold text-white hover:bg-black'
            : 'shrink-0 text-sm font-medium text-gray-700 hover:text-gray-900'
        }
      >
        {actionLabel}
      </button>
    </div>
  );
}

function MetricTile({
  label,
  value,
  icon,
}: {
  label: string;
  value: string | number;
  icon?: React.ReactNode;
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4">
      <p className="text-sm text-gray-600">{label}</p>
      <div className="mt-2 flex items-center justify-between">
        <p className="text-2xl font-semibold text-gray-900">{value}</p>
        {icon ? <div className="text-gray-700">{icon}</div> : null}
      </div>
    </div>
  );
}
