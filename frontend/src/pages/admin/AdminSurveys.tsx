import { Link } from 'react-router-dom';
import { Plus } from 'lucide-react';

export default function AdminSurveys() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">Surveys</h1>
        <Link
          to="/admin/create-survey"
          className="inline-flex items-center gap-2 rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-black"
        >
          <Plus className="h-4 w-4" />
          Create Survey
        </Link>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-8 text-center">
        <p className="font-semibold text-gray-900">No surveys yet</p>
        <p className="mt-1 text-sm text-gray-600">
          Surveys will appear here once programs are configured.
        </p>
      </div>
    </div>
  );
}
