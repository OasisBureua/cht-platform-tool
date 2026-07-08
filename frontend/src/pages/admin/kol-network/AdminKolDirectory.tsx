import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Loader2, Search, Stethoscope } from 'lucide-react';
import { kolNetworkApi, type PublicKolList } from '../../../api/kol-network';
import { demoKolList } from './lib/intel';
import { Card } from './components/Card';
import { Badge, DemoBadge } from './components/Badge';
import { Input } from './components/Input';
import { InitialsAvatar } from './components/InitialsAvatar';

const SELECT_CLASS =
  'h-10 rounded-input border border-input bg-card px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent';

/**
 * Internal KOL directory — admin intel entry point. Lists the public KOL
 * roster (live, proxied from MediaHub via the CHT backend) and links each
 * row into the HCP intel detail view.
 *
 * When the backend is unreachable (network error OR a malformed non-API
 * response on the port), the page falls back to the seeded demo roster in
 * lib/intel.ts so it stays reviewable frontend-only. Live behavior is
 * unchanged whenever the API returns a valid payload — including a valid
 * empty list.
 */
export default function AdminKolDirectory() {
  const [inputValue, setInputValue] = useState('');
  const [region, setRegion] = useState('');
  const [institution, setInstitution] = useState('');

  const [q, setQ] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setQ(inputValue.trim()), 350);
    return () => clearTimeout(t);
  }, [inputValue]);

  const { data, isLoading, isError, isFetching } = useQuery({
    queryKey: ['admin', 'kol-network', { q, region, institution }],
    // 'always' + no retry: attempt the request even when react-query's
    // onlineManager thinks the browser is offline, and reject on the FIRST
    // failure. With the app default (retry: 1) a failed attempt parks the
    // query in fetchStatus 'paused' whenever the tab is unfocused/offline —
    // it never reaches error state and the demo fallback can't kick in.
    networkMode: 'always',
    retry: false,
    queryFn: async (): Promise<PublicKolList> => {
      const res = await kolNetworkApi.list({
        q: q || undefined,
        region: region || undefined,
        institution: institution || undefined,
        limit: 200,
      });
      // A non-API service on the port (or a proxy misroute) can resolve with
      // a 200 whose body isn't our payload. Treat malformed shapes as errors
      // so the demo fallback kicks in instead of rendering "undefined".
      if (!res || !Array.isArray(res.items) || typeof res.total !== 'number') {
        throw new Error('Malformed /kol-network response (backend unreachable?)');
      }
      return res;
    },
  });

  // Fallback ONLY on error — a valid empty list still renders the live
  // empty state. Filters are applied client-side against the demo roster.
  const usingDemo = isError;
  const list: PublicKolList | undefined = usingDemo
    ? demoKolList({
        q: q || undefined,
        region: region || undefined,
        institution: institution || undefined,
      })
    : data;

  const items = list?.items ?? [];
  const total = typeof list?.total === 'number' ? list.total : items.length;

  return (
    <div className="space-y-5">
      {/* Page header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-foreground">
            <Stethoscope className="h-6 w-6 text-primary" />
            KOL Network
            {usingDemo && <DemoBadge />}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {usingDemo
              ? `Internal HCP intelligence · demo roster (backend unreachable) · ${total} profiles`
              : `Internal HCP intelligence · roster synced from MediaHub${list ? ` · ${total} profiles` : ''}`}
          </p>
        </div>
        {isFetching && !isLoading && (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-label="Refreshing" />
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Search name, specialty, institution…"
            className="pl-9"
            aria-label="Search KOLs"
          />
        </div>
        <select
          value={region}
          onChange={(e) => setRegion(e.target.value)}
          className={SELECT_CLASS}
          aria-label="Filter by region"
        >
          <option value="">All regions</option>
          {(list?.regions ?? []).map((r) => (
            <option key={r.slug} value={r.slug}>
              {r.label} ({r.kol_count})
            </option>
          ))}
        </select>
        <select
          value={institution}
          onChange={(e) => setInstitution(e.target.value)}
          className={SELECT_CLASS}
          aria-label="Filter by institution"
        >
          <option value="">All institutions</option>
          {(list?.institutions ?? []).map((inst) => (
            <option key={inst} value={inst}>
              {inst}
            </option>
          ))}
        </select>
      </div>

      {/* Table */}
      <Card className="overflow-hidden">
        {isLoading ? (
          <div className="flex min-h-[240px] items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-label="Loading" />
          </div>
        ) : items.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground">
            No KOLs match the current filters.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-label uppercase text-muted-foreground">
                  <th className="px-4 py-3 font-semibold">Name</th>
                  <th className="px-4 py-3 font-semibold">Title / Specialty</th>
                  <th className="px-4 py-3 font-semibold">Institution</th>
                  <th className="px-4 py-3 font-semibold">Region</th>
                  <th className="px-4 py-3 text-right font-semibold">Shoots</th>
                  <th className="px-4 py-3 font-semibold" aria-label="Flags" />
                </tr>
              </thead>
              <tbody>
                {items.map((k) => (
                  <tr
                    key={k.id}
                    className="border-b border-border transition-colors last:border-0 hover:bg-muted/40"
                  >
                    <td className="px-4 py-3">
                      <Link
                        to={`/admin/kol-network/hcps/${encodeURIComponent(k.slug || k.id)}`}
                        className="group inline-flex items-center gap-3 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <InitialsAvatar
                          name={k.name}
                          photoUrl={k.photo_url}
                          className="h-9 w-9 shrink-0 text-xs"
                        />
                        <span className="font-semibold text-foreground group-hover:text-primary-600 dark:group-hover:text-primary-300">
                          {k.name}
                        </span>
                      </Link>
                    </td>
                    <td className="max-w-[240px] px-4 py-3 text-muted-foreground">
                      <p className="truncate">{k.title ?? '—'}</p>
                      {k.specialty && (
                        <p className="truncate text-xs text-muted-foreground/80">{k.specialty}</p>
                      )}
                    </td>
                    <td className="max-w-[220px] truncate px-4 py-3 text-muted-foreground">
                      {k.institution ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {k.region_label ?? k.region ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums text-foreground">
                      {k.shoot_count}
                    </td>
                    <td className="px-4 py-3">{k.is_new && <Badge variant="accent">New</Badge>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {list && items.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Showing {items.length} of {total}
        </p>
      )}
    </div>
  );
}
