import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ScrollText } from 'lucide-react';
import { adminApi } from '../../api/admin';
import LoadingSpinner from '../../components/ui/LoadingSpinner';

export default function AdminAuditLog() {
  const [resource, setResource] = useState('');
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['admin', 'audit-logs', resource],
    queryFn: () =>
      adminApi.listAuditLogs({
        limit: 200,
        resource: resource.trim() || undefined,
      }),
  });

  const items = data?.items ?? [];
  const resources = useMemo(() => {
    const set = new Set<string>();
    for (const row of items) {
      if (row.resource) set.add(row.resource);
    }
    return [...set].sort();
  }, [items]);

  if (isLoading) return <LoadingSpinner />;

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 flex items-center gap-2">
            <ScrollText className="h-6 w-6 text-gray-700" aria-hidden />
            Admin audit log
          </h1>
          <p className="mt-1 text-sm text-gray-600">
            Mutation trail for admin actions (approvals, payments, program edits, Content Hub writes).
          </p>
        </div>
        <label className="text-sm text-gray-700">
          Resource
          <select
            className="mt-1 block rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
            value={resource}
            onChange={(e) => setResource(e.target.value)}
          >
            <option value="">All</option>
            {resources.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </label>
      </header>

      {isError ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error instanceof Error ? error.message : 'Failed to load audit log.'}
        </p>
      ) : null}

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-4 py-3 font-semibold">When</th>
              <th className="px-4 py-3 font-semibold">Actor</th>
              <th className="px-4 py-3 font-semibold">Action</th>
              <th className="px-4 py-3 font-semibold">Resource</th>
              <th className="px-4 py-3 font-semibold">IP</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {items.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                  No audit entries yet.
                </td>
              </tr>
            ) : (
              items.map((row) => (
                <tr key={row.id} className="align-top hover:bg-gray-50/80">
                  <td className="whitespace-nowrap px-4 py-3 text-gray-700">
                    {format(new Date(row.createdAt), 'MMM d, yyyy HH:mm:ss')}
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">
                      {row.actorEmail || row.actorId}
                    </div>
                    {row.actorEmail ? (
                      <div className="text-xs text-gray-500">{row.actorId}</div>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-800">
                    {row.action}
                  </td>
                  <td className="px-4 py-3 text-gray-700">
                    {row.resource || '—'}
                    {row.resourceId ? (
                      <div className="font-mono text-xs text-gray-500">
                        {row.resourceId}
                      </div>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-600">
                    {row.ipAddress || '—'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {data ? (
        <p className="text-xs text-gray-500">
          Showing {items.length} of {data.total} (limit {data.limit})
        </p>
      ) : null}
    </div>
  );
}
