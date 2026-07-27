import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ExternalLink, Loader2, Search } from 'lucide-react';
import { Link } from 'react-router-dom';
import { adminApi, type AdminKolNetworkItem } from '../../api/admin';

function formatUsd(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(amount);
}

function VisibilityToggle({
  label,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-gray-700 dark:text-zinc-300">
      <input
        type="checkbox"
        className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span>{label}</span>
    </label>
  );
}

function KolRow({
  kol,
  onVisibilityChange,
  isUpdating,
}: {
  kol: AdminKolNetworkItem;
  onVisibilityChange: (patch: { visibleOnPublic?: boolean; visibleOnApp?: boolean }) => void;
  isUpdating: boolean;
}) {
  const slug = kol.slug || kol.id;
  const pubs = kol.intel?.publications_approx;
  const payments = kol.intel?.open_payments;

  return (
    <tr className="align-top">
      <td className="px-4 py-3">
        <div className="font-medium text-gray-900 dark:text-zinc-100">{kol.name}</div>
        <div className="mt-0.5 text-xs text-gray-500 dark:text-zinc-400">
          {kol.institution || '-'}
          {kol.region_label ? ` · ${kol.region_label}` : ''}
        </div>
        <Link
          to={`/kol-network/profile/${encodeURIComponent(slug)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-brand-700 hover:underline dark:text-brand-400"
        >
          View public profile
          <ExternalLink className="h-3 w-3" aria-hidden />
        </Link>
      </td>
      <td className="px-4 py-3 text-sm text-gray-700 dark:text-zinc-300">
        <div>{kol.shoot_count} CHM video{kol.shoot_count === 1 ? '' : 's'}</div>
        {typeof pubs === 'number' ? (
          <div className="text-xs text-gray-500 dark:text-zinc-400">~{pubs} publications</div>
        ) : null}
        {payments?.total != null ? (
          <div className="text-xs text-gray-500 dark:text-zinc-400">
            Open Payments {formatUsd(payments.total)}
            {payments.years ? ` (${payments.years})` : ''}
          </div>
        ) : null}
      </td>
      <td className="px-4 py-3">
        <div className="flex flex-col gap-2">
          <VisibilityToggle
            label="Public site"
            checked={kol.visibility.visibleOnPublic}
            disabled={isUpdating}
            onChange={(visibleOnPublic) => onVisibilityChange({ visibleOnPublic })}
          />
          <VisibilityToggle
            label="Member app"
            checked={kol.visibility.visibleOnApp}
            disabled={isUpdating}
            onChange={(visibleOnApp) => onVisibilityChange({ visibleOnApp })}
          />
        </div>
      </td>
    </tr>
  );
}

export default function AdminKolNetwork() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => window.clearTimeout(t);
  }, [search]);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['admin', 'kol-network', debouncedSearch],
    queryFn: () => adminApi.getKolNetwork({ q: debouncedSearch || undefined }),
  });

  const updateVisibility = useMutation({
    mutationFn: ({
      slug,
      patch,
    }: {
      slug: string;
      patch: { visibleOnPublic?: boolean; visibleOnApp?: boolean };
    }) => adminApi.updateKolVisibility(slug, patch),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'kol-network'] });
      queryClient.invalidateQueries({ queryKey: ['kol-network'] });
    },
  });

  const items = data?.items ?? [];
  const hiddenPublic = items.filter((k) => !k.visibility.visibleOnPublic).length;
  const hiddenApp = items.filter((k) => !k.visibility.visibleOnApp).length;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-zinc-100">KOL Network</h1>
        <p className="mt-1 text-sm text-gray-600 dark:text-zinc-400">
          Manage which physicians appear on the public KOL directory and in the member app. Roster and
          intel analytics come from Content Hub; visibility is stored in CHT.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-zinc-400">
            Total KOLs
          </p>
          <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-zinc-100">{data?.total ?? '-'}</p>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-zinc-400">
            Hidden on public
          </p>
          <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-zinc-100">{hiddenPublic}</p>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-zinc-400">
            Hidden in app
          </p>
          <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-zinc-100">{hiddenApp}</p>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Search className="h-5 w-5 text-gray-500" aria-hidden />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-zinc-100">Directory</h2>
          </div>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name or institution…"
            className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950 sm:max-w-xs"
          />
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center gap-2 py-12 text-gray-500">
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
            Loading KOL roster…
          </div>
        ) : isError ? (
          <div className="py-12 text-center text-sm text-red-600">
            Could not load the KOL roster. Check Content Hub connectivity and try again.
          </div>
        ) : items.length === 0 ? (
          <div className="py-12 text-center text-sm text-gray-500">No KOLs match your search.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-zinc-800">
              <thead>
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">KOL</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Analytics</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Visibility</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-zinc-800">
                {items.map((kol) => {
                  const slug = kol.slug || kol.id;
                  return (
                    <KolRow
                      key={slug}
                      kol={kol}
                      isUpdating={updateVisibility.isPending && updateVisibility.variables?.slug === slug}
                      onVisibilityChange={(patch) => updateVisibility.mutate({ slug, patch })}
                    />
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
