import { useEffect } from 'react';
import { Link, useParams, Navigate, useLocation } from 'react-router-dom';
import { getRegionFromDirectory, useKolDirectory } from '../../hooks/useKolDirectory';
import { ChevronLeft, Loader2, Stethoscope } from 'lucide-react';
import { kolNetworkBaseFromPath, kolProfilePath, kolRegionPath } from '../../utils/kol-network-paths';

export default function DolRegionDetail() {
  const { regionSlug } = useParams<{ regionSlug: string }>();
  const location = useLocation();
  const networkBase = kolNetworkBaseFromPath(location.pathname);
  const embedded = location.pathname.startsWith('/app');
  const directory = useKolDirectory({
    surface: embedded ? 'app' : 'public',
  });
  const region = regionSlug ? getRegionFromDirectory(directory, regionSlug) : null;

  useEffect(() => {
    const id = location.hash.replace(/^#/, '');
    if (!id) return;
    const t = requestAnimationFrame(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    return () => cancelAnimationFrame(t);
  }, [location.hash, region?.id]);

  if (directory.loadState === 'loading') {
    return embedded ? (
      <div className="flex justify-center py-20">
        <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" aria-label="Loading state" />
      </div>
    ) : (
      <div className="bg-card px-6 py-20 text-center text-muted-foreground">Loading state…</div>
    );
  }
  if (!region) {
    return <Navigate to={networkBase} replace />;
  }

  if (embedded) {
    return (
      <div className="space-y-6">
        <div>
          <Link
            to={networkBase}
            className="mb-3 inline-flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft className="h-4 w-4" />
            KOL Network
          </Link>
          <header className="space-y-2">
            <div className="flex items-center gap-2.5 text-foreground">
              <Stethoscope className="h-5 w-5 text-steel-600 dark:text-steel-400" strokeWidth={2} aria-hidden />
              <h1 className="text-balance text-2xl font-bold tracking-tight text-foreground md:text-3xl">
                {region.title}
              </h1>
            </div>
            <p className="text-sm text-muted-foreground">
              {region.entries.length} {region.entries.length === 1 ? 'specialist' : 'specialists'}
              {region.subtitle ? ` · ${region.subtitle}` : ''}
            </p>
          </header>
        </div>

        <div className="divide-y divide-border overflow-hidden rounded-card border border-border/90 bg-card shadow-[0_1px_0_rgba(0,0,0,0.04),0_8px_28px_-12px_rgba(0,0,0,0.06)]">
          {region.entries.map((entry) => (
            <div key={entry.id} id={entry.id} className="scroll-mt-24 space-y-2 p-4 sm:p-5">
              <div className="flex items-start justify-between gap-3">
                <h2 className="text-base font-semibold text-foreground">
                  {entry.name}
                  {entry.isNew ? (
                    <span className="ml-2 text-[10px] font-semibold uppercase tracking-wide text-orange-800 dark:text-orange-200">
                      New
                    </span>
                  ) : null}
                </h2>
                <Link
                  to={kolProfilePath(networkBase, entry.id)}
                  className="shrink-0 text-sm font-semibold text-steel-700 hover:underline dark:text-steel-400"
                >
                  View profile
                </Link>
              </div>
              <p className="text-sm text-muted-foreground">
                <span className="font-medium text-foreground">Role:</span> {entry.role}
              </p>
              {entry.bio ? (
                <p className="text-sm leading-relaxed text-muted-foreground line-clamp-4">{entry.bio}</p>
              ) : null}
            </div>
          ))}
        </div>

        {directory.regions.length > 1 ? (
          <section className="space-y-3">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Other states
            </h3>
            <div className="flex flex-wrap gap-2">
              {directory.regions
                .filter((r) => r.id !== region.id)
                .map((r) => (
                  <Link
                    key={r.id}
                    to={kolRegionPath(networkBase, r.id)}
                    className="rounded-[6px] border border-border bg-card px-3.5 py-2 text-sm font-medium text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                  >
                    {r.title}
                  </Link>
                ))}
            </div>
          </section>
        ) : null}
      </div>
    );
  }

  return (
    <div className="bg-card">
      <section>
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
          <Link
            to={networkBase}
            className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft className="h-4 w-4" />
            All states
          </Link>
          <div className="max-w-3xl space-y-2">
            <h1 className="text-4xl font-semibold leading-tight tracking-tight text-foreground md:text-5xl">
              Key Opinion Leader (KOL) Network
            </h1>
            <p className="text-sm leading-relaxed text-muted-foreground md:text-base">
              Oncology & Breast Cancer Specialists
            </p>
          </div>
        </div>
      </section>

      <section className="py-6 sm:py-8">
        <div className="mx-auto max-w-7xl space-y-4 px-4 sm:px-6">
          <div>
            <h2 className="text-2xl font-semibold text-foreground md:text-3xl">{region.title}</h2>
            {region.subtitle ? (
              <p className="mt-1 text-base text-muted-foreground">{region.subtitle}</p>
            ) : null}
          </div>
          <div className="space-y-6">
            {region.entries.map((entry) => (
              <div
                key={entry.id}
                id={entry.id}
                className="scroll-mt-24 space-y-3 rounded-card border border-border bg-card p-5 sm:p-6"
              >
                <div className="flex items-start justify-between gap-4">
                  <h3 className="text-lg font-semibold text-foreground">
                    {entry.name}
                    {entry.isNew ? (
                      <span className="ml-2 text-xs font-medium text-muted-foreground">★ NEW</span>
                    ) : null}
                  </h3>
                  <Link
                    to={kolProfilePath(networkBase, entry.id)}
                    className="shrink-0 text-sm font-semibold text-brand-700 hover:text-brand-900"
                  >
                    View profile →
                  </Link>
                </div>
                <p className="text-sm font-medium text-muted-foreground">
                  <span className="text-muted-foreground">Role:</span> {entry.role}
                </p>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  <span className="text-muted-foreground">Bio:</span> {entry.bio}
                </p>
                <p className="text-sm text-muted-foreground">
                  <span className="text-muted-foreground">Education:</span> {entry.education}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-border py-6">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Other states
          </h3>
          <div className="flex flex-wrap gap-2">
            {directory.regions
              .filter((r) => r.id !== region.id)
              .map((r) => (
                <Link
                  key={r.id}
                  to={kolRegionPath(networkBase, r.id)}
                  className="rounded-[6px] border border-border px-4 py-2 text-sm font-medium text-muted-foreground hover:border-border hover:bg-muted"
                >
                  {r.title}
                </Link>
              ))}
          </div>
        </div>
      </section>

      <div className="border-t border-border py-6">
        <p className="text-center text-xs text-muted-foreground">
          Community Health Technologies - Confidential KOL Network Document | ★ = Newly Added
        </p>
      </div>
    </div>
  );
}
