import { useEffect } from 'react';
import { Link, useParams, Navigate, useLocation } from 'react-router-dom';
import { getRegionFromDirectory, useKolDirectory } from '../../hooks/useKolDirectory';
import { ChevronLeft } from 'lucide-react';

export default function DolRegionDetail() {
  const { regionSlug } = useParams<{ regionSlug: string }>();
  const location = useLocation();
  const directory = useKolDirectory();
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
    return (
      <div className="bg-card px-6 py-20 text-center text-muted-foreground">Loading state…</div>
    );
  }
  if (!region) {
    return <Navigate to="/kol-network" replace />;
  }

  return (
    <div className="bg-card">
      {/* Hero */}
      <section>
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-6 sm:py-8">
          <Link
            to="/kol-network"
            className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground mb-4"
          >
            <ChevronLeft className="h-4 w-4" />
            All states
          </Link>
          <div className="max-w-3xl space-y-2">
            <h1 className="text-4xl md:text-5xl font-semibold tracking-tight text-foreground leading-tight">
              Key Opinion Leader (KOL) Network
            </h1>
            <p className="text-sm md:text-base text-muted-foreground leading-relaxed">
              Oncology & Breast Cancer Specialists
            </p>
          </div>
        </div>
      </section>

      {/* Region */}
      <section className="py-6 sm:py-8">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 space-y-4">
          <div>
            <h2 className="text-2xl md:text-3xl font-semibold text-foreground">
              {region.title}
            </h2>
            {region.subtitle && (
              <p className="mt-1 text-base text-muted-foreground">{region.subtitle}</p>
            )}
          </div>
          <div className="space-y-6">
            {region.entries.map((entry) => (
              <div
                key={entry.id}
                id={entry.id}
                className="rounded-card border border-border bg-card p-5 sm:p-6 space-y-3 scroll-mt-24"
              >
                <div className="flex items-start justify-between gap-4">
                  <h3 className="text-lg font-semibold text-foreground">
                    {entry.name}
                    {entry.isNew && (
                      <span className="ml-2 text-xs font-medium text-muted-foreground">★ NEW</span>
                    )}
                  </h3>
                  <Link
                    to={`/kol-network/profile/${entry.id}`}
                    className="shrink-0 text-sm font-semibold text-brand-700 hover:text-brand-900"
                  >
                    View profile →
                  </Link>
                </div>
                <p className="text-sm font-medium text-muted-foreground">
                  <span className="text-muted-foreground">Role:</span> {entry.role}
                </p>
                <p className="text-sm text-muted-foreground leading-relaxed">
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

      {/* Region nav */}
      <section className="border-t border-border py-6">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">
            Other states
          </h3>
          <div className="flex flex-wrap gap-2">
            {directory.regions
              .filter((r) => r.id !== region.id)
              .map((r) => (
                <Link
                  key={r.id}
                  to={`/kol-network/${r.id}`}
                  className="rounded-[6px] border border-border px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:border-border"
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
