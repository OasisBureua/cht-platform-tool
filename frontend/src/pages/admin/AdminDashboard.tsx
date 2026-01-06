import { BookOpen, Users, CreditCard, ClipboardList } from 'lucide-react';

export default function AdminDashboard() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Admin Dashboard</h1>
        <p className="text-sm text-gray-600">
          Overview of platform activity and operations.
        </p>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <MetricCard
          label="Active Programs"
          value="12"
          icon={<BookOpen className="h-5 w-5" />}
        />
        <MetricCard
          label="Registered HCPs"
          value="1,248"
          icon={<Users className="h-5 w-5" />}
        />
        <MetricCard
          label="Pending Surveys"
          value="86"
          icon={<ClipboardList className="h-5 w-5" />}
        />
        <MetricCard
          label="Pending Payments"
          value="$42,300"
          icon={<CreditCard className="h-5 w-5" />}
        />
      </div>

      {/* Empty insights */}
      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <p className="text-sm font-semibold text-gray-900">
          Insights
        </p>
        <p className="mt-1 text-sm text-gray-600">
          Detailed analytics and reporting will appear here.
        </p>
      </div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 flex items-center gap-4">
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100 text-gray-900">
        {icon}
      </div>
      <div>
        <p className="text-xs font-semibold text-gray-600">{label}</p>
        <p className="text-lg font-semibold text-gray-900">{value}</p>
      </div>
    </div>
  );
}
