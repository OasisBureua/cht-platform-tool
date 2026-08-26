import { Link } from 'react-router-dom';
import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2 } from 'lucide-react';
import { surveysApi } from '../../api/surveys';
import { adminApi } from '../../api/admin';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import { adminSurveyDisplayTitle } from '../../utils/admin-survey-display';

export default function AdminSurveys() {
  const queryClient = useQueryClient();
  const [programFilter, setProgramFilter] = useState<string>('all');

  const { data: surveyList, isLoading, error } = useQuery({
    queryKey: ['admin', 'surveys'],
    queryFn: () => surveysApi.getAll(),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => adminApi.deleteSurvey(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'surveys'] });
    },
  });

  const items = surveyList?.active ?? [];

  const programOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const s of items) {
      if (s.program?.id && s.program.title) {
        seen.set(s.program.id, s.program.title);
      }
    }
    return Array.from(seen.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [items]);

  const filteredItems = useMemo(
    () =>
      programFilter === 'all'
        ? items
        : items.filter((s) => s.program?.id === programFilter),
    [items, programFilter],
  );

  const handleDelete = (id: string, displayTitle: string) => {
    if (!window.confirm(`Delete survey "${displayTitle}"? This cannot be undone.`)) return;
    deleteMutation.mutate(id);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoadingSpinner />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-destructive/25 bg-destructive/10 p-4 text-destructive">
        Failed to load surveys. Please try again.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {deleteMutation.isError && (
        <div className="rounded-xl border border-destructive/25 bg-destructive/10 p-4 text-destructive flex items-center justify-between">
          <span>Failed to delete survey. Please try again.</span>
          <button
            type="button"
            onClick={() => deleteMutation.reset()}
            className="text-sm font-semibold text-destructive underline"
          >
            Dismiss
          </button>
        </div>
      )}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Surveys</h1>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <label className="text-sm font-semibold text-muted-foreground shrink-0">Filter by program:</label>
            <select
              value={programFilter}
              onChange={(e) => setProgramFilter(e.target.value)}
              className="rounded-lg border border-border bg-card px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-gray-900"
            >
              <option value="all">All programs</option>
              {programOptions.map(([id, title]) => (
                <option key={id} value={id}>
                  {title}
                </option>
              ))}
            </select>
            {programFilter !== 'all' ? (
              <button
                type="button"
                onClick={() => setProgramFilter('all')}
                className="text-xs font-semibold text-muted-foreground underline hover:text-foreground"
              >
                Clear
              </button>
            ) : null}
          </div>
        </div>
        <Link
          to="/admin/create-survey"
          className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 shrink-0"
        >
          <Plus className="h-4 w-4" />
          Create Survey
        </Link>
      </div>

      {items.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-8 text-center">
          <p className="font-semibold text-foreground">No surveys yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Create a survey to gather feedback from programs.
          </p>
          <Link
            to="/admin/create-survey"
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
          >
            <Plus className="h-4 w-4" />
            Create Survey
          </Link>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-8 text-center">
          <p className="font-semibold text-foreground">No surveys for this program</p>
          <p className="mt-1 text-sm text-muted-foreground">Try another program or clear the filter.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted border-b border-border">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Survey</th>
                <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Type</th>
                <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Jotform</th>
                <th className="px-4 py-3 text-right font-semibold text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredItems.map((s) => {
                const displayTitle = adminSurveyDisplayTitle(
                  s.program?.title,
                  s.type,
                  s.title,
                );
                return (
                  <tr key={s.id} className="hover:bg-muted">
                    <td className="px-4 py-3 font-medium text-foreground">{displayTitle}</td>
                    <td className="px-4 py-3 text-muted-foreground">{s.type}</td>
                    <td className="px-4 py-3 text-muted-foreground">
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
                        <span className="text-muted-foreground">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-3">
                        <Link
                          to={`/admin/surveys/${s.id}/responses`}
                          className="text-sm font-semibold text-blue-700 hover:underline"
                        >
                          Responses
                        </Link>
                        <Link
                          to={`/admin/surveys/${s.id}/edit`}
                          className="text-sm font-semibold text-foreground hover:underline"
                        >
                          Edit
                        </Link>
                        <button
                          type="button"
                          onClick={() => handleDelete(s.id, displayTitle)}
                          disabled={deleteMutation.isPending && deleteMutation.variables === s.id}
                          className="text-sm font-semibold text-destructive hover:underline disabled:opacity-50"
                          title="Delete survey"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
