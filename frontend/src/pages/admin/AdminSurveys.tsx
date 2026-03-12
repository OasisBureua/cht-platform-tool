import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { surveysApi } from '../../api/surveys';
import LoadingSpinner from '../../components/ui/LoadingSpinner';

export default function AdminSurveys() {
  const { data: surveys, isLoading, error } = useQuery({
    queryKey: ['admin', 'surveys'],
    queryFn: () => surveysApi.getAll(),
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
        Failed to load surveys. Please try again.
      </div>
    );
  }

  const items = surveys ?? [];

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

      {items.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white p-8 text-center">
          <p className="font-semibold text-gray-900">No surveys yet</p>
          <p className="mt-1 text-sm text-gray-600">
            Create a survey to gather feedback from programs.
          </p>
          <Link
            to="/admin/create-survey"
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-black"
          >
            <Plus className="h-4 w-4" />
            Create Survey
          </Link>
        </div>
      ) : (
        <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-gray-600">Survey</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600">Program</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600">Type</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600">Jotform</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {items.map((s) => (
                <tr key={s.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{s.title}</td>
                  <td className="px-4 py-3 text-gray-700">{s.program?.title ?? '-'}</td>
                  <td className="px-4 py-3 text-gray-700">{s.type}</td>
                  <td className="px-4 py-3 text-gray-700">
                    {s.jotformFormId ? (
                      <a
                        href={`https://communityhealthmedia.jotform.com/${s.jotformFormId}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-blue-600 hover:underline"
                      >
                        {s.jotformFormId}
                      </a>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      to={`/admin/surveys/${s.id}/edit`}
                      className="text-sm font-semibold text-gray-900 hover:underline"
                    >
                      Edit
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
