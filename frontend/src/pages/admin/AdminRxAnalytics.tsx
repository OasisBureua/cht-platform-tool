import { Link } from 'react-router-dom';
import { FileBarChart } from 'lucide-react';

/**
 * Legacy RX Analytics placeholder retired.
 * Campaign / channel reporting lives in Content Hub.
 */
export default function AdminRxAnalytics() {
  return (
    <div className="mx-auto max-w-2xl space-y-6 rounded-2xl border border-gray-200 bg-white p-8">
      <div className="flex items-start gap-3">
        <FileBarChart className="mt-0.5 h-6 w-6 text-brand-700" aria-hidden />
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reporting moved</h1>
          <p className="mt-2 text-sm text-gray-600">
            The placeholder RX Analytics dashboard has been replaced by Content Hub
            campaign reports (analytics + executive), HubSpot sync, and CSV uploads.
          </p>
        </div>
      </div>
      <div className="flex flex-wrap gap-3">
        <Link
          to="/admin/content-hub"
          className="inline-flex rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
        >
          Open Content Hub reporting
        </Link>
        <Link
          to="/admin"
          className="inline-flex rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
        >
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}
