import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Calendar, MoreVertical } from 'lucide-react';
import { adminApi, type AdminProgram } from '../../api/admin';
import LoadingSpinner from '../../components/ui/LoadingSpinner';

export default function AdminPrograms() {
  const { data: programs, isLoading, error } = useQuery({
    queryKey: ['admin', 'programs'],
    queryFn: () => adminApi.getPrograms(),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoadingSpinner />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">
        Failed to load programs. Please try again.
      </div>
    );
  }

  const items = programs ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Programs</h1>
          <p className="text-sm text-gray-600">
            Manage educational programs and webinars.
          </p>
        </div>

        <Link
          to="/admin/webinar-scheduler"
          className="inline-flex items-center gap-2 rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-black"
        >
          <Calendar className="h-4 w-4" />
          Schedule Webinar
        </Link>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">
                Program
              </th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">
                Sponsor
              </th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">
                Status
              </th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">
                Credits
              </th>
              <th className="px-4 py-3" />
            </tr>
          </thead>

          <tbody className="divide-y divide-gray-200">
            {items.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                  No programs yet. Create one via Schedule Webinar.
                </td>
              </tr>
            ) : (
              items.map((p) => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">
                    {p.title}
                  </td>
                  <td className="px-4 py-3 text-gray-700">
                    {p.sponsorName}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={p.status} />
                  </td>
                  <td className="px-4 py-3 text-gray-700">
                    {p.creditAmount} CME
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button className="text-gray-500 hover:text-gray-700">
                      <MoreVertical className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: AdminProgram['status'] }) {
  const label = status === 'PUBLISHED' ? 'Active' : status === 'DRAFT' ? 'Draft' : 'Archived';
  const styles =
    status === 'PUBLISHED'
      ? 'bg-green-50 text-green-700 border-green-200'
      : status === 'ARCHIVED'
        ? 'bg-gray-100 text-gray-500 border-gray-200'
        : 'bg-amber-50 text-amber-700 border-amber-200';

  return (
    <span
      className={[
        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold',
        styles,
      ].join(' ')}
    >
      {label}
    </span>
  );
}
