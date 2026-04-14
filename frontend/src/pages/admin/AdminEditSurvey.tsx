import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { surveysApi } from '../../api/surveys';
import { adminApi } from '../../api/admin';
import LoadingSpinner from '../../components/ui/LoadingSpinner';

export default function AdminEditSurvey() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [jotformFormId, setJotformFormId] = useState('');

  const { data: survey, isLoading, isError } = useQuery({
    queryKey: ['survey', id],
    queryFn: () => surveysApi.getById(id!),
    enabled: Boolean(id),
  });

  useEffect(() => {
    if (survey?.jotformFormId) {
      setJotformFormId(survey.jotformFormId);
    }
  }, [survey?.jotformFormId]);

  const updateMutation = useMutation({
    mutationFn: (payload: { jotformFormId?: string }) =>
      adminApi.updateSurvey(id!, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'surveys'] });
      queryClient.invalidateQueries({ queryKey: ['survey', id] });
      navigate('/admin/surveys');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateMutation.mutate({
      jotformFormId: jotformFormId.trim() || undefined,
    });
  };

  if (isLoading) return <LoadingSpinner />;

  if (isError || !survey) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-gray-50 p-10 text-center">
        <p className="font-semibold text-gray-900">Survey not found</p>
        <Link
          to="/admin/surveys"
          className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-gray-900 hover:underline"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to surveys
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-3xl">
      <div>
        <Link
          to="/admin/surveys"
          className="inline-flex items-center gap-2 text-sm font-semibold text-gray-700 hover:text-gray-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to surveys
        </Link>
        <h1 className="mt-4 text-2xl font-bold text-gray-900">Edit Survey</h1>
        <p className="mt-1 text-sm text-gray-600">{survey.title}</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-6">
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-1">
              Jotform Form ID
            </label>
            <input
              type="text"
              value={jotformFormId}
              onChange={(e) => setJotformFormId(e.target.value)}
              placeholder="e.g., 260698533879881 — from communityhealthmedia.jotform.com/build/..."
              className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm"
            />
            <p className="mt-1 text-xs text-gray-500">
              Link this survey to a Jotform form. Ensure the form has the webhook and Hidden Box (user_id) configured.
            </p>
          </div>
        </div>

        {updateMutation.isError && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-700 text-sm">
            Failed to update survey. Please try again.
          </div>
        )}

        <div className="flex gap-4">
          <button
            type="button"
            onClick={() => navigate('/admin/surveys')}
            className="rounded-xl border border-gray-200 bg-white px-6 py-2.5 text-sm font-semibold text-gray-900 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={updateMutation.isPending}
            className="rounded-xl bg-gray-900 px-6 py-2.5 text-sm font-semibold text-white hover:bg-black disabled:opacity-50"
          >
            {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </form>
    </div>
  );
}
