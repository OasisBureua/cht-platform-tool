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
    <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
      <input
        type="checkbox"
        className="h-4 w-4 rounded border-border text-brand-600 focus:ring-brand-500"
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
        <div className="font-medium text-foreground">{kol.name}</div>
        <div className="mt-0.5 text-xs text-muted-foreground">
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
      <td className="px-4 py-3 text-sm text-muted-foreground">
        <div>{kol.shoot_count} CHM video{kol.shoot_count === 1 ? '' : 's'}</div>
        {typeof pubs === 'number' ? (
          <div className="text-xs text-muted-foreground">~{pubs} publications</div>
        ) : null}
        {payments?.total != null ? (
          <div className="text-xs text-muted-foreground">
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
        <h1 className="text-2xl font-bold text-foreground">KOL Network</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage which physicians appear on the public KOL directory and in the member app. Roster and
          intel analytics come from Content Hub; visibility is stored in CHT.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-card border border-border bg-card p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Total KOLs
          </p>
          <p className="mt-1 text-2xl font-bold text-foreground">{data?.total ?? '-'}</p>
        </div>
        <div className="rounded-card border border-border bg-card p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Hidden on public
          </p>
          <p className="mt-1 text-2xl font-bold text-foreground">{hiddenPublic}</p>
        </div>
        <div className="rounded-card border border-border bg-card p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Hidden in app
          </p>
          <p className="mt-1 text-2xl font-bold text-foreground">{hiddenApp}</p>
        </div>
      </div>

      <div className="rounded-card border border-border bg-card p-6">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Search className="h-5 w-5 text-muted-foreground" aria-hidden />
            <h2 className="text-lg font-semibold text-foreground">Directory</h2>
          </div>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name or institution…"
            className="w-full rounded-xl border border-border px-3 py-2 text-sm dark:bg-zinc-950 sm:max-w-xs"
          />
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center gap-2 py-12 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
            Loading KOL roster…
          </div>
        ) : isError ? (
          <div className="py-12 text-center text-sm text-destructive">
            Could not load the KOL roster. Check Content Hub connectivity and try again.
          </div>
        ) : items.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground">No KOLs match your search.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-border">
              <thead>
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">KOL</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">Analytics</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">Visibility</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
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
